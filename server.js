const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const url = require("url");
const httpRequest = require("./http-v2.js");
const crypto = require("crypto");
const initKeepieStuff = require("./keepie-stuff.js");

const app = express();
const upload = multer();

app.use("/www", express.static(path.join(__dirname, "www")));

app.get("/status", (req, res) => {
    res.json({
        up: true,
        meta: {
            "up": "whether this is up, or not."
        }
    });
});

app.get("/issue", function (req, res) {
    res.sendFile(path.join(__dirname, "index.html"));
});

initKeepieStuff(app);
app.keepieEndpoint("/issuedb-secret");
app.keepieEndpoint("/userdb-secret");

async function appInit(listener, crankerRouterUrls, app) {
    const localAddress = `http://localhost:${listener.address().port}`;
    const crankerEndpoint = crankerRouterUrls[0]; 
    const keepieUrl = `http://${crankerEndpoint}/issuedb/keepie/write/request`;

    app.get("/issue/top", async (req, res) => {
        const topUrl = `http://${crankerEndpoint}/issuedb/issue`;
        const {service, secret} = await app.keepieResponse("/issuedb-secret", keepieUrl, listener);
        const response = await httpRequest(topUrl, {
            auth: `${service}:${secret}`
        });

        if (response.statusCode&400 == 400) {
            return response.sendStatus(400);
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

            const logUrl = `http://${crankerEndpoint}/issuedb/log`;
            const {service, secret} = await app.keepieResponse("/issuedb-secret", keepieUrl, listener);
            const response = await httpRequest(logUrl, {
                method: "POST",
                auth: `${service}:${secret}`,
                headers: { "content-type": "application/json" },
                requestBody: JSON.stringify(struct)
            });
            
            if (response.statusCode&400 == 400) {
                return res.status(400).send(`issuedb post error ${response}`);
            }

            if (response.statusCode == 200) {
                const body = await response.body();
                const data = JSON.parse(body);
                return res.status(201).json(data);
            }
        }
        catch (e) {
            res.status(400).send(`error somewhere ${e}`);
        }
        res.status(400).send("unknown error");
    });
}

const boot = async function () {
    const listener = app.listen(8027, async function () {
        appInit(listener, process.env["CRANKER_ENDPOINTS"].split(","), app);
    });
    return listener;
}

exports.boot = boot;

if (require.main === module) {
    exports.boot().then();
}

// End
