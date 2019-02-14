const start = require("./start-listener.js");
const {Transform} = require("stream");
const path = require("path");
const fs = require("fs");
const rewire = require("rewire");
const url = require("url");
const querystring = require("querystring");
const http = require("http");
const stream = require("stream");
const httpRequest = require("./http-v2.js");
const assert = require("assert");

const server = rewire("./server.js");
const serverBoot = server.__get__("boot");

function jparse(source) {
    try {
        return [undefined, JSON.parse(source)];
    }
    catch (e) {
        return [e];
    }
}

async function test() {
    // Set environment variable to point at keepie auth file
    const authorizedWritersFile = path.join(__dirname, "test-write-auth.json");
    process.env["ISSUEDB_KEEPIE_WRITE"] = authorizedWritersFile;

    // Start the issuedb pglog
    const [crankerRouter,
           issueDbPort,
           issueDbProcess,
           issueDbPipe] = await start("issuedb/boot.js", "issuedb");;
    issueDbPipe.pipe(process.stdout);
    console.log("issuedb: port", issueDbPort);
    console.log("cranker router port", crankerRouter.getListener().address().port);
    console.log("cranker router cranker port", crankerRouter.getCrankerListener().address().port);

    // Set the KEEPIEURL env var to the port that the server just started
    process.env["KEEPIEURL"] = `http://localhost:${issueDbPort}/keepie/write/request`;
    const serverListener = await new Promise(async (resolve, reject) => {
        const serverListener = await serverBoot();
        const serverPort = serverListener.address().port;
        await fs.promises.writeFile(
            authorizedWritersFile,
            JSON.stringify([`http://localhost:${serverPort}/issuedb-secret`]) + "\n"
        );
        resolve(serverListener);
    });

    // Output the cranked paths now that everything is started up
    const crankerPort = crankerRouter.getListener().address().port;
    const crankerUrl = `http://localhost:${crankerPort}/health`;
    const crankedPathsResponse = await httpRequest(crankerUrl);
    const crankedPaths = await crankedPathsResponse.body();
    console.log("cranked paths", crankedPaths);

    // now we can test a post
    const statuses = [
        "it's broken",
        "it's bad",
        "c'est merde",
        "petit merde",
        "all gorn"
    ];
    const status = statuses[Math.floor(Math.random() * Math.floor(statuses.length))];
    const updateData = {
        summary: status,
        description: "I have been writing javascript code for 2 years and have now discovered it is single threaded.",
        editor: "nicferrier"
    };
    const formData = querystring.stringify(updateData);
    const serverPort = serverListener.address().port;

    const issueUrl = `http://localhost:${serverPort}/issue`;
    const response = await httpRequest(issueUrl, {
        method: "POST",
        headers: {
            "content-type": "application/x-www-form-urlencoded",
            "content-length": Buffer.byteLength(formData)
        },
        requestBody: formData
    });
    const body = await response.body();

    assert(response.statusCode == 201, `create issue response was not 201: ${JSON.stringify(response)} ${JSON.stringify(body)}`);
    const [createIssueJsonError, createdIssueData] = jparse(body);
    assert(createIssueJsonError === undefined, `create issue json does not parse: ${createIssueJsonError} ${createdIssueData}`);
    console.log("created log data", createdIssueData);

    const topIssuesResponse = await httpRequest(issueUrl + "/top");
    const topIssuesBody = await topIssuesResponse.body();
    const [topIssuesJsonError, topIssuesData] = jparse(topIssuesBody);
    assert(topIssuesJsonError === undefined, `top issues json does not parse: ${topIssuesJsonError} ${topIssuesBody}`);
    assert(topIssuesData[0].id == createdIssueData[0].log_insert, `top issue is not what we just created: ${topIssuesData[0]}`);

    // Finally, let's...
    issueDbProcess.kill("SIGINT");
    crankerRouter.getListener().close();
    crankerRouter.getCrankerListener().close();
    serverListener.close();
    console.log("closed everything?");
    return 0;
}

test()
    .then(exitCode => console.log(exitCode))
    .catch(e => console.log(e));

// End
