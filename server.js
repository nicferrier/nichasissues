const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const url = require("url");
const crypto = require("crypto");
const bcrypt = require("bcrypt-nodejs");
const httpRequest = require("./http-v2.js");
const initKeepieStuff = require("./keepie-stuff.js");
const cookieParser = require("cookie-parser");
const authServices = require("./auth-services.js");

const app = express();
initKeepieStuff(app);
app.keepieEndpoint("/issuedb-secret");
app.keepieEndpoint("/userdb-secret");

app.use("/www", express.static(path.join(__dirname, "www")));
app.use(cookieParser());

app.get("/status", (req, res) => {
    res.json({
        up: true,
        meta: {
            "up": "whether this is up, or not."
        }
    });
});

app.get(new RegExp("[/](register|login)$"), function (req, res) {
    const [pathPart] = Object.values(req.params) || [];
    const filePath = pathPart == "issue" ? "index" : pathPart;
    res.sendFile(path.join(__dirname, `${filePath}.html`));
});

async function appInit(listener, crankerRouterUrls, app) {
    const localAddress = `http://localhost:${listener.address().port}`;
    const crankerEndpoint = crankerRouterUrls[0]; 
    const formHandler = bodyParser.urlencoded({extended: true});
    const {middleware: auth, login, register}
          = await authServices(listener, crankerEndpoint, app);

    app.post("/login", login, function (req, res) {
        if (res.statusCode == 400) {
            // set this on a cookie or something?
            console.log(res.loginError);
            return res.redirect("/login");
        }

        res.redirect("/issue");
    });
    app.post("/register", register, function (req, res) {
        if (res.statusCode == 400) {
            return res.redirect("/register");
        }

        res.redirect("/login");
    });

    app.get("/issue/context", auth, function (req, res) {
        res.json({
            authData: req.authData
        });
    });
    
    app.get("/issue", auth, function (req, res) {
        res.sendFile(path.join(__dirname, "index.html"));
    });

    app.get("/issue/top", auth, async (req, res) => {
        const keepieUrl = `http://${crankerEndpoint}/issuedb/keepie/write/request`;
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

    app.get("/user/all", auth, async (req, res) => {
        const keepieUrl = `http://${crankerEndpoint}/userdb/keepie/write/request`;
        const topUrl = `http://${crankerEndpoint}/userdb/users`;
        const {service, secret} = await app.keepieResponse("/userdb-secret", keepieUrl, listener);
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

    app.post("/issue", auth, formHandler, async function (req, res) {
        const keepieUrl = `http://${crankerEndpoint}/issuedb/keepie/write/request`;
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
            console.log("error sending issue", e);
            return res.status(400).send(`error somewhere in issue ${JSON.stringify(e.message)}`);
        }
        return res.status(400).send("unknown error");
    });
}

const boot = async function () {
    const listener = app.listen(8027, async function () {
        console.log(`listening on ${listener.address().port}`);
        appInit(listener, process.env["CRANKER_ENDPOINTS"].split(","), app);
    });
    return listener;
}

exports.boot = boot;

if (require.main === module) {
    exports.boot().then();
}

// End
