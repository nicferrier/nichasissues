const start = require("./start-listener.js");
const {Transform} = require("stream");
const path = require("path");
const fs = require("fs");
const rewire = require("rewire");
const url = require("url");
const querystring = require("querystring");
const http = require("http");
const stream = require("stream");

const server = rewire("./server.js");
const serverIssueApi = server.__get__("issueApi");
const serverBoot = server.__get__("boot");

async function test() {
    // Set environment variable to point at keepie auth file
    const authorizedWritersFile = path.join(__dirname, "test-write-auth.json");
    process.env["ISSUEDB_KEEPIE_WRITE"] = authorizedWritersFile;

    // Start the issuedb pglog
    const [issueDbPort, issueDbProcess, issueDbPipe] = await start("issuedb/boot.js", "issuedb");
    issueDbPipe.pipe(process.stdout);
    console.log("issuedb: port", issueDbPort);

    // Set the KEEPIEURL env var to the port that the server just started
    process.env["KEEPIEURL"] = `http://localhost:${issueDbPort}/keepie/write/request`;
    const [serverPassword, serverListener] = await new Promise(async (resolve, reject) => {
        let serverListener;
        const oldSetPassword = serverIssueApi.setPassword;
        serverIssueApi.setPassword = function (password) {
            oldSetPassword.call(serverIssueApi, password);
            resolve([password, serverListener]);
        };

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
