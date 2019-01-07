const start = require("./start-listener.js");
const {Transform} = require("stream");
const path = require("path");
const fs = require("fs");
const rewire = require("rewire");
const server = rewire("./server.js");
const url = require("url");
const querystring = require("querystring");
const http = require("http");
const stream = require("stream");

async function test() {
    const authorizedWritersFile = path.join(__dirname, "test-write-auth.json");
    process.env["ISSUEDB_KEEPIE_WRITE"] = authorizedWritersFile;
    const [issueDbPort, issueDbProcess, issueDbPipe] = await start("issuedb/boot.js", "issuedb");
    issueDbPipe.pipe(process.stdout);
    console.log("issuedb: port", issueDbPort);

    process.env["KEEPIEURL"] = `http://localhost:${issueDbPort}/keepie/write/request`;
    const [serverPassword, serverListener] = await new Promise(async (resolve, reject) => {
        let serverListener;
        const serverIssueSender = server.__get__("issueSender");
        const oldSetPassword = serverIssueSender.setPassword;
        serverIssueSender.setPassword = function (password) {
            oldSetPassword.call(serverIssueSender, password);
            resolve([password, serverListener]);
        };

        const serverBoot = server.__get__("boot");
        serverListener = await serverBoot();
        const serverPort = serverListener.address().port;
        await fs.promises.writeFile(
            authorizedWritersFile,
            JSON.stringify([`http://localhost:${serverPort}/issuedb-secret`]) + "\n"
        );
    });

    console.log("password arrived!", serverPassword);
    // now we can test a post
    const [responseStatus, responseData] = await new Promise((resolve, reject) => {
        const formData = querystring.stringify({
            summary: "this is outrageous!",
            description: "I have been writing javascript code for 2 years and have now discovered it is single threaded.",
            editor: "nicferrier"
        });
        const request = {
            method: "POST",
            host: "localhost",
            port: serverListener.address().port,
            path: "/issue",
            headers: {
                "content-type": "application/x-www-form-urlencoded",
                "content-length": Buffer.byteLength(formData)
            }
        };
        let buffer = "";
        http.request(request, function (response) {
            response.pipe(new stream.Writable({
                write(chunk, encoding, next) {
                    buffer = buffer + chunk;
                    next();
                },
                final(next) {
                    resolve([response.statusCode, buffer]);
                }
            }));
        }).end(formData);
    });

    console.log("response", responseStatus, responseData);
    
    // Finally, let's...
    issueDbProcess.kill("SIGINT");
    serverListener.close();
    console.log("closed everything?");
    return 0;
}

test().then(exitCode => console.log(exitCode));

// End
