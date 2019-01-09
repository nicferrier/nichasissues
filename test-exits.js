const {Transform} = require("stream");
const path = require("path");
const start = require("./start-listener.js");

async function testit() {
    const [issueDbPort, issueDbProcess, issueDbPipe] = await start("issuedb/boot.js", "issuedb");
    issueDbPipe.pipe(process.stdout);
    setTimeout(_ => issueDbProcess.kill("SIGINT"), 5000);
}

testit().then();
