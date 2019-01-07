const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const http = require("http");
const multer = require("multer");
const stream = require("stream");
const url = require("url");

const app = express();
const upload = multer();

class IssueSender {
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
        return new Promise((resolve, reject) => {
            console.log("server: sending POST to issuedb", struct, this.password, this.pgLogApiPort);
            http.request({
                method: "POST",
                host: "localhost",
                port: this.pgLogApiPort,
                path: "/db/log",
                auth: `log:${this.password}`,
                headers: {
                    "content-type": "application/json"
                }
            }, response => {
                let buffer = "";
                response.pipe(new stream.Writable({
                    write(chunk, encoding, next) {
                        buffer = buffer + chunk;
                        next();
                    },
                    final(next) {
                        resolve([response.statusCode, buffer]);
                    }
                }));
            }).end(JSON.stringify(struct));
        });
    }
}

const issueSender = new IssueSender();

app.post("/issuedb-secret", upload.array(), function (req, res) {
    try {
        const {name: serviceName, password} = req.body;
        issueSender.setPassword(password);
        res.sendStatus(204);
    }
    catch (e) {
        res.sendStatus(400);
    }
});

app.use("/www", express.static(path.join(__dirname, "www")));

// homepage
app.get("/issue", function (req, res) {
    res.sendFile(path.join(__dirname, "index.html"));
});

const formHandler = bodyParser.urlencoded({extended: true});
app.post("/issue", formHandler, async function (req, res) {
    try {
        const {summary, description, editor} = req.body;
        const edit = new Date();
        const editTime = edit.valueOf();
        const struct = {
            summary: summary,
            description: description,
            editor: editor,
            editTime: editTime
        }
        const [statusCode, body] = await issueSender.send(struct);
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

async function requestPasswordFromKeepie(listener, path) {
    const {address, port} = listener.address();
    // fixme: this is wrong
    const hostName = address == "::" ? "localhost" : address;
    const receiptUrl = `http://${hostName}:${port}${path}`;
    const keepieUrl = process.env.KEEPIEURL;
    console.log("KEEPIEURL", keepieUrl);
    const {hostname, port: keepiePort, pathname} = url.parse(keepieUrl);
    issueSender.setPort(keepiePort);
    const request = {
        method: "POST",
        host: hostname,
        port: keepiePort,
        path: pathname,
        headers: {
            "x-receipt-url": receiptUrl
        }
    };
    http.request(request, function (response) {}).end();
}

const boot = async function () {
    const listener = app.listen(8027, async function () {
        const port = listener.address().port;
        console.log("listening on", port, listener.address());
        await requestPasswordFromKeepie(listener, "/issuedb-secret");
    });
    return listener;
}

if (require.main === module) {
    exports.boot().then();
}

// End
