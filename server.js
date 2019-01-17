const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const http = require("http");
const multer = require("multer");
const stream = require("stream");
const url = require("url");
const httpRequestObject = require("./http-object.js");
const crypto = require("crypto");

const app = express();
const upload = multer();

const issueSecretWaiting = [];
app.post("/issuedb-secret", upload.array(), function (req, res) {
    try {
        const {name: serviceName, password} = req.body;
        function send(queue) {
            if (queue.length < 1) return;
            const resolvable = queue.pop();
            resolvable({service: serviceName, secret: password});
            send(queue);
        }
        send(issueSecretWaiting);
        res.sendStatus(204);
    }
    catch (e) {
        res.sendStatus(400);
    }
});

const userSecretWaiting = [];
app.post("/userdb-secret", upload.array(), function (req, res) {
    try {
        const {name: serviceName, password} = req.body;
        console.log("keepie secret received for:", serviceName);
        function send(queue) {
            if (queue.length < 1) return;
            const resolvable = queue.pop();
            resolvable({service: serviceName, secret: password});
            send(queue);
        }
        send(userSecretWaiting);
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


async function appInit(listener, crankerRouterUrls, app) {
    app.get("/issue/top", async (req, res) => {
        const topUrl = `http://${crankerRouterUrls[0]}/issuedb/issue`;
        const requestor = httpRequestObject(topUrl);
        let response = await requestor();
        if (response.statusCode&400 == 400
            && response.headers["x-keepie-location"] !== undefined) {
            const keepieLocation = response.headers["x-keepie-location"];
            console.log("keepie url", keepieLocation);
            const receiptUrl = "http://localhost:8027/issuedb-secret"; // FIXME what's the receipt url???
            const keepieRequestor = httpRequestObject(keepieLocation, {
                method: "POST",
                headers: {
                    "x-receipt-url": receiptUrl
                }
            });
            const keepieResponse = await keepieRequestor();

            // This waits for the keepie request to arrive by pushing
            // the resolve function into a list which the keepie
            // handler retrieves and calls
            const {service, secret} = await new Promise((resolve, reject) => {
                issueSecretWaiting.push(resolve);
            });

            response = await requestor({auth:`log:${secret}`});
        }

        const body = await response.body();
        const [error, data] = await Promise.resolve([undefined, JSON.parse(body)]).catch(e => [e]);
        if (error !== undefined) {
            return res.sendStatus(400);
        }
        res.json(data.splice(0,5));
    });

    const formHandler = bodyParser.urlencoded({extended: true});
    app.post("/issue", formHandler, async function (req, res) {
        function cryptit() {
            return new Promise((resolve, reject) => {
                crypto.pseudoRandomBytes(16, function(err, raw) {
                    if (err) reject(err);
                    else resolve(raw.toString("hex"));
                });
            });
        }

        try {
            console.log("issue handler", req.body);
            const {summary, description, editor} = req.body;
            const edit = new Date();
            const editTime = edit.valueOf();
            const struct = {
                issueid: await cryptit(),
                state: "OPEN",
                summary: summary,
                description: description,
                editor: editor,
                editTime: editTime
            };

            const logUrl = `http://${crankerRouterUrls[0]}/issuedb/log`;
            console.log("log url", logUrl);
            const requestor = httpRequestObject(logUrl, {
                method: "POST",
                headers: {
                    "content-type": "application/json"
                },
                requestBody: JSON.stringify(struct)
            });
            console.log("made an http obj");

            let response = await requestor();
            console.log("oops - got an error", response);
            if (response.statusCode&400 == 400
                && response.headers["x-keepie-location"] !== undefined) {
                const keepieLocation = response.headers["x-keepie-location"];
                console.log("keepie url", keepieLocation);
                const receiptUrl = "http://localhost:8027/issuedb-secret"; // FIXME what's the receipt url???
                const keepieRequestor = httpRequestObject(keepieLocation, {
                    method: "POST",
                    headers: {
                        "x-receipt-url": receiptUrl
                    }
                });
                const keepieResponse = await keepieRequestor();
                console.log("keepieResponse!", keepieResponse);
                const {service, secret} = await new Promise((resolve, reject) => {
                    issueSecretWaiting.push(resolve);
                });
                console.log("and got back", service, secret);
                response = await requestor({auth:`log:${secret}`});
            }
            
            if (response.statusCode == 200) {
                console.log("issuedb response", response);
                res.status(201);
                const body = await response.body();
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
}

const boot = async function () {
    const listener = app.listen(8027, async function () {
        const port = listener.address().port;
        const addr = listener.address().address;
        console.log("addr", addr);

        appInit(listener, process.env["CRANKER_ENDPOINTS"].split(","), app);

        const host = addr == "::" ? "localhost" : addr; // FIXME probably wrong
        const url = `http://${host}:${port}/issue`;
        console.log(`listening on ${port}`);
        console.log(`contact on ${url}`);
    });
    return listener;
}

exports.boot = boot;

if (require.main === module) {
    exports.boot().then();
}

// End
