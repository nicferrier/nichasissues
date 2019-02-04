const { spawn } = require("child_process");
const stream = require("stream");
const path = require("path");
const fs = require("fs");
const express = require("express");
const httpRequest = require("./http-v2.js");
const router = require("cranker-router");

let childCount = 0;

const start = async function(crankerRouter, scriptName, prefixOut=undefined) {
    console.log("starting", scriptName);
    const prefix = prefixOut === undefined ? "" : prefixOut + ": ";
    const dir = path.dirname(scriptName);
    const script = path.basename(scriptName);
    const nodeBin = process.argv[0];
    child = spawn(nodeBin, [script], {
        cwd: dir,
        env: Object.assign({
            "PGLOGLEVEL": "notice"
        }, process.env)
    });
    childCount++;
    console.log("spawning", script, dir, "prefix=", prefixOut, "nodeBin", nodeBin);
    const [listeningPort, piped] = await new Promise(async (resolve, reject) => {
        child.stderr.pipe(process.stderr);
        child.on("listening", resolve);
        // For test we want to not hang on the keeperListener
        child.on("exit", _ => {
            childCount--;
            if (childCount == 0) {
                console.log("child count 0 so shutting down keeperListener");
                // keeperListener.close();
            }
        });
        const piped = child
              .stdout.pipe(new stream.Transform({
                  transform(chunk, encoding, callback) {
                      const dataBuf = chunk.toString();
                      if (dataBuf !== undefined) {
                          const match =  /(^|\n)listening on[ ]+([0-9]+)/.exec(dataBuf);
                          // console.log("dataBuf>", match, dataBuf);
                          if (match != null) {
                              const [_1, _2, port, ...rest] = match;
                              child.emit("listening", [port, piped]);
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
    return [crankerRouter, listeningPort, child, piped];
};

async function startPackageDir(routerObject, stdout, dir) {
    const packageFile = path.resolve(dir, "package.json");
    try {
        const text = await fs.promises.readFile(packageFile);

        const [parseError, data] = await Promise.resolve(
            [undefined, JSON.parse(new String(text))]
        ).catch(e => [e]);

        if (parseError !== undefined) {
            return parseError;
        }

        const bootScript = data.scripts.boot;
        const bootPath = path.resolve(dir, bootScript);

        const scriptPrefix = path.basename(dir);
        const [_, listeningPort, child, piped]
              = await start(routerObject, bootPath, scriptPrefix);
        const stdoutPiped = piped.pipe(stdout);
        return [undefined, [listeningPort, child, stdoutPiped]];
    }
    catch (e) { 
        // console.log("error while starting package", dir, e);
        return [e];
    }
}

const startAll = async function (routerObject, dir=process.cwd()) {
    const top = await fs.promises.readdir(dir);
    const stats = await Promise.all(top.map(d => fs.promises.stat(d).catch(v => {
        return {isDirectory: _ => false};
    })));
    const dirs = await Promise.all(
        top.filter(
            (d, i) => stats[i].isDirectory() && !path.basename(d).startsWith(".")
        )
    );
    const resolved = dirs.map(c => path.resolve(dir, c));
    resolved.push(dir); // push the origin dir on so we get that one too

    console.log("startAll starting", resolved);

    // Recursive loop starting new processes
    const run = async function (stdout, [dir, ...dirs]) {
        let newPipe = stdout;
        const [error, result] = await startPackageDir(routerObject, stdout, dir);

        if (error === undefined) {
            const [listeningPort, child, pipedStdout] = result;
            newPipe = pipedStdout;
        }

        if (dirs !== undefined && dirs.length > 0) {
            await run(newPipe, dirs);
        }
    };
    await run(process.stdout, resolved);

    // FIXME - Don't really need this bit  ... just an extra bit of testing?
    const routerPort = routerObject.getListener().address().port;
    const routerUrl = `http://localhost:${routerPort}/health`;
    const response = await httpRequest(routerUrl);
    const body = await response.body();
    console.log("ROUTES", await Promise.resolve(JSON.parse(body)).catch(e => e));
}

async function startRouter() {
    const routerObject = await router(0);
    routerObject.addStatusRoute("/health");
    return routerObject;
}

async function startUp(routerObject, argv=[]) {
    const crankerPort = routerObject.getCrankerListener().address().port;
    const crankerConnectEndpoint = `localhost:${crankerPort}`;
    process.env["CRANKER_ROUTERS"] = crankerConnectEndpoint;
    const routerPort = routerObject.getListener().address().port
    const crankerRouterEndpoint = `localhost:${routerPort}`
    process.env["CRANKER_ENDPOINTS"] = crankerRouterEndpoint;

    // FIXME - probably broken since the refactor
    const scripts = argv.slice(2);
    console.log("scripts", scripts);
    if (scripts !== undefined && scripts.length > 0) {
        const run = async (scripts, stdout) => {  // FIXME - this is all broken I think
            const [bootScript, ...otherScripts] = scripts;
            if (bootScript !== undefined) {
                try {
                    console.log("booting", bootScript);
                    const baseName = path.basename(bootScript);
                    const dirName = path.basename(path.dirname(bootScript));
                    [listeningPort, child, piped] = await start(bootScript, bootScript);
                    console.log(`running ${bootScript} on ${listeningPort}`);
                    const pipedResult = piped.pipe(stdout);
                    run(otherScripts, pipedResult);
                }
                catch (e) {
                    console.log(`can't run script because`, e);
                }
            }
        };
        run(scripts, process.stdout);
    }
    else {
        await startAll(routerObject);
    }
}

async function fromMainStartUp(argv) {
    const routerObject = await startRouter();
    startUp(routerObject, argv);
}

if (require.main === module) {
    fromMainStartUp(process.argv).then();
}
else {
    async function exportMain(scriptName, prefix) {
        const routerObject = await startRouter();
        const crankerPort = routerObject.getCrankerListener().address().port;
        const crankerEndpoint = `localhost:${crankerPort}`;
        process.env["CRANKER_ROUTERS"] = crankerEndpoint;
        const routerPort = routerObject.getListener().address().port
        const crankerRouterEndpoint = `localhost:${routerPort}`
        process.env["CRANKER_ENDPOINTS"] = crankerRouterEndpoint;
        return await start(routerObject, scriptName, prefix);
    }
    module.exports = exportMain;
}

// End
