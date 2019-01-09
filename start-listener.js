const { spawn } = require("child_process");
const stream = require("stream");
const path = require("path");
const fs = require("fs");
const express = require("express");
const http = require("http");

const app = express();
const statusData = {
    scripts: {}    // FIXME this is probably wrong, should be better schema
};
app.get("/status", (req, res) => { res.json(statusData); });
const keeperListener = app.listen(0, _ => {
    const port = keeperListener.address().port;
    const keeperUrl = `http://localhost:${port}/status`;
    process.env["STATUS_KEEPER_URL"] = keeperUrl;
    console.log(`start-listener collating status data at: ${keeperUrl}`);
});

let childCount = 0;

// scriptName is the path of the script to start
//
// - the script will print "listening on <port>" at some point and
// this will be captured as the port
//
// prefixOut is a string to prefix all output lines
//
// - if undefined then no prefixing is done
//
// returns [listeningPort, childProcess, pipeToOut]
const start = async function(scriptName, prefixOut=undefined) {
    console.log("starting", scriptName);
    const prefix = prefixOut === undefined ? "" : prefixOut + ": ";
    const dir = path.dirname(scriptName);
    const script = path.basename(scriptName);
    const nodeBin = process.argv[0];
    child = spawn(nodeBin, [script], {
        cwd: dir,
        env: Object.assign({"PGLOGLEVEL": "notice"}, process.env)
    });
    childCount++;
    console.log("spawning", script, dir, "prefix=", prefixOut);
    const [listeningPort, piped] = await new Promise(async (resolve, reject) => {
        child.stderr.pipe(process.stderr);
        child.on("listening", resolve);
        // For test we want to not hang on the keeperListener
        child.on("exit", _ => {
            childCount--;
            if (childCount == 0) {
                console.log("child count 0 so shutting down keeperListener");
                keeperListener.close();
            }
        });
        const piped = child
              .stdout.pipe(new stream.Transform({
                  transform(chunk, encoding, callback) {
                      const dataBuf = chunk.toString();
                      const found = /(^|\n)listening on[ ]+([0-9]+)/.exec(dataBuf);
                      if (found != null) {
                          const [_1, _2, port, ...rest] = found;
                          child.emit("listening", [port, piped]);
                          try {
                              const request = {
                                  method: "GET",
                                  hostname: "localhost",
                                  path: "/status",
                                  port: port
                              };
                              let buffer = "";
                              http.request(request, response => {
                                  // console.log("got status response from", port, scriptName, response.statusCode);
                                  response.pipe(stream.Writable({
                                      write(chunk, encoding, next) {
                                          buffer = buffer + chunk;
                                          next();
                                      },
                                      final(next) {
                                          try {
                                              if (response.statusCode != 200) {
                                                  throw new Error(`bad response: ${response.statusCode}`);
                                              }
                                              const jsonData = JSON.parse(buffer);
                                              statusData.scripts[prefixOut !== undefined ? prefixOut : "" + port] = jsonData;
                                          }
                                          catch (e) {
                                              console.log(`status error from ${scriptName}: ${e}`);
                                          }
                                          next();
                                      }
                                  }))
                              }).end();
                          }
                          catch (e) {
                              console.log("ERRROR!!!", e);
                          }
                      }

                      const lineArray = dataBuf.split("\n");
                      const lines = dataBuf.endsWith("\n") ? lineArray.splice(0, lineArray.length - 1) : [dataBuf];
                      const prefixed = lines.map(line => prefix + "" + line);
                      this.push(prefixed.join("\n") + "\n");

                      callback();
                  }
              }));
    });
    return [listeningPort, child, piped];
};

const startAll = async function (dir=process.cwd()) {
    const top = await fs.promises.readdir(dir);
    const stats = await Promise.all(top.map(d => fs.promises.stat(d).catch(v => {
        return {isDirectory: _ => false};
    })));
    const dirs = await Promise.all(top.filter((d, i) => stats[i].isDirectory()));
    dirs.push(dir); // push the origin dir on so we get that one too
    const candidateDirs = dirs.filter(d => !path.basename(d).startsWith("."));
    const packageCandidates = await Promise.all(candidateDirs.map(d => fs.promises.readdir(d)));
    const packages = candidateDirs.filter((d, i) => packageCandidates[i].indexOf("package.json") > -1);
    const fqPackages = packages.map(p => path.resolve(dir, p));
    const packageJsonFile = await Promise.all(fqPackages.map(p => fs.promises.readFile(path.join(p, "package.json"))));
    const packageJson = packageJsonFile.map(jf => JSON.parse(new String(jf)));
    const packageAndJson = packageJson.map((j,i) => { return {json: j, package: fqPackages[i]};});
    const bootable = packageAndJson.filter(p => p.json.scripts.boot != undefined);
    const toBoot = await bootable.map(p => Object.assign({path: path.resolve(p.package, p.json.scripts.boot)}, p));
    const run = async (scripts, stdout) => {
        const [bootScriptObject, ...otherScripts] = scripts;
        if (bootScriptObject !== undefined) {
            try {
                const {path:bootScript, json:bootablePackageJson, package} = bootScriptObject;
                console.log("booting", bootScript, package, bootablePackageJson);
                const baseName = path.basename(bootScript);
                const dirName = path.basename(path.dirname(bootScript));
                const scriptName = bootablePackageJson.name;
                [listeningPort, child, piped] = await start(bootScript, scriptName);
                console.log(`running ${scriptName} on ${listeningPort}`);
                const pipedResult = piped.pipe(stdout);
                run(otherScripts, pipedResult);
            }
            catch (e) {
                console.log(`can't run script because`, e);
            }
        }
    };
    run(toBoot, process.stdout);
}

if (require.main === module) {
    const scriptName = process.argv[2];
    // start(scriptName);
    startAll().then();
}
else {
    module.exports = start;
}

// End
