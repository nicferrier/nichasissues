const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const http = require("http");
const multer = require("multer");
const stream = require("stream");
const url = require("url");
const httpRequest = require("./httptx.js");

const app = express();
const upload = multer();

// quick simple fetch style promise http client

class IssueAPI {
    constructor() {
    }

    setPort(port) {
        this.pgLogApiPort = port;
    }

    setPassword(password) {
        this.password = password;
    }

    send(struct) {
        if (this.password == undefined || this.pgLogApiPort == undefined) {
            return Promise.reject(new Error("keepie not initialized"));
        }
        return new Promise(async (resolve, reject) => {
            console.log("server: sending POST to issuedb", struct, this.password, this.pgLogApiPort);
            const issueDbUrl = `http://localhost:${this.pgLogApiPort}/db/log`;
            const response = await httpRequest(issueDbUrl, {
                method: "POST",
                auth: `log:${this.password}`,
                headers: {
                    "content-type": "application/json"
                },
                requestBody: JSON.stringify(struct)
            });
            const body = await response.body();
            resolve([response.statusCode, body]);
        });
    }

    async issues() {
        if (this.password == undefined || this.pgLogApiPort == undefined) {
            return Promise.reject(new Error("keepie not initialized"));
        }
        const issueDbUrl = `http://localhost:${this.pgLogApiPort}/issue`;
        const response = await httpRequest(issueDbUrl);
        return response;
    }
}

const issueApi = new IssueAPI();

app.post("/issuedb-secret", upload.array(), function (req, res) {
    try {
        const {name: serviceName, password} = req.body;
        console.log("keepie secret received for:", serviceName);
        issueApi.setPassword(password);
        res.sendStatus(204);
    }
    catch (e) {
        res.sendStatus(400);
    }
});

app.use("/www", express.static(path.join(__dirname, "www")));

app.get("/status", (req, res) => {
    res.json({
        up: true,
        meta: {
            "up": "whether this is up, or not."
        }
    });
});

// homepage
app.get("/issue", function (req, res) {
    res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/issue/top", async (req, res) => {
    const response = await issueApi.issues();
    const body = await response.body();
    const data = JSON.parse(body);
    res.json(data.splice(0,5));
});

const formHandler = bodyParser.urlencoded({extended: true});
app.post("/issue", formHandler, async function (req, res) {
    try {
        console.log("issue handler", req.body);
        const {summary, description, editor} = req.body;
        const edit = new Date();
        const editTime = edit.valueOf();
        const struct = {
            summary: summary,
            description: description,
            editor: editor,
            editTime: editTime
        }
        const [statusCode, body] = await issueApi.send(struct);
        if (statusCode == 200) {
            res.status(201);
            const data = JSON.parse(body);
            res.json(data);
            return;
        }
    }
    catch (e) {
        console.log("error", e, req.body);
    }
    res.sendStatus(400);
});

async function requestStatusKeeperKeepie() {
    console.log("request StatusKeeper's url", process.env.STATUS_KEEPER_URL);
    if (process.env.STATUS_KEEPER_URL === undefined) {
        return undefined;
    }
    const response = await httpRequest(process.env.STATUS_KEEPER_URL);
    if (response.statusCode == 200) {
        const keeperBody = await response.body();
        const keeperData = JSON.parse(keeperBody);
        const { scripts: {"issue-pglogapi": {keepieUrl}} } = keeperData;
        console.log("StatusKeeper's pgLogApi keepieUrl", keepieUrl);
        return keepieUrl;
    }
    return undefined;
}

async function requestPasswordFromKeepie(listener, path) {
    const {address, port} = listener.address();
    // fixme: this is wrong
    const hostName = address == "::" ? "localhost" : address;
    const receiptUrl = `http://${hostName}:${port}${path}`;
    const keepieUrl = await ((process.env.KEEPIEURL === undefined)
                             ? requestStatusKeeperKeepie()
                             : process.env.KEEPIEURL);
    if (keepieUrl === undefined) return;

    const urlObj = url.parse(keepieUrl);
    const {hostname, port: keepiePort, path:pathname} = urlObj;
    // We also get the issuedb from the KeepieUrl
    issueApi.setPort(keepiePort);
    const request = {
        method: "POST",
        host: hostname,
        port: keepiePort,
        path: pathname,
        headers: {
            "x-receipt-url": receiptUrl
        }
    };
    http.request(request, function (response) {
        console.log("keepie request to", request, "returned", response.statusCode);
    }).end();
}

const boot = async function () {
    const listener = app.listen(8027, async function () {
        const port = listener.address().port;
        const addr = listener.address().address;
        console.log("addr", addr);
        const host = addr == "::" ? "localhost" : addr; // FIXME probably wrong
        const url = `http://${host}:${port}/issue`;
        console.log(`listening on ${port}`);
        console.log(`contact on ${url}`);
        await requestPasswordFromKeepie(listener, "/issuedb-secret");
    });
    return listener;
}

exports.boot = boot;

if (require.main === module) {
    console.log("starting?");
    exports.boot().then();
}

// End
