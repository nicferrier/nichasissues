const { spawn } = require("child_process");
const { Transform } = require("stream");
const path = require("path");

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
    const prefix = prefixOut === undefined ? "" : prefixOut + ": ";
    const dir = path.dirname(scriptName);
    const script = path.basename(scriptName);
    const nodeBin = process.argv[0];
    child = spawn(nodeBin, [script], {cwd: dir});
    const [listeningPort, piped] = await new Promise(async (resolve, reject) => {
        child.stderr.pipe(process.stderr);
        child.on("listening", resolve);
        const piped = child
              .stdout.pipe(new Transform({
                  transform(chunk, encoding, callback) {
                      const dataBuf = chunk.toString();
                      // console.log("dataBuf!", dataBuf);
                      const found = /^listening on[ ]+([0-9]+)/.exec(dataBuf);
                      if (found != null) {
                          const [_, port, ...rest] = found;
                          child.emit("listening", [port, piped]);
                      }

                      const lineArray = dataBuf.split("\n");
                      const lines = dataBuf.endsWith("\n") ? lineArray.splice(0, lineArray.length - 1) : dataBuf;
                      const prefixed = lines.map(line => prefix + "" + line);
                      this.push(prefixed.join("\n") + "\n");

                      callback();
                  }
              }));
    });
    return [listeningPort, child, piped];
};

if (require.main === module) {
    const scriptName = process.argv[2];
    start(scriptName);
}
else {
    module.exports = start;
}
// End
