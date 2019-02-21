const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const url = require("url");
const crypto = require("crypto");
const bcrypt = require("bcrypt-nodejs");
const httpRequest = require("./http-v2.js");
const initKeepieStuff = require("./keepie-stuff.js");
const cookieParser = require("cookie-parser");

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

    const auth = async function(req, res, next) {
        const [email, sessionId] = req.cookies.sesh.split(":");
        const keepieUrl = `http://${crankerEndpoint}/userdb/keepie/write/request`;
        const sessionUrl = `http://${crankerEndpoint}/userdb/session/${sessionId}`;

        const {service, secret} = await app.keepieResponse("/userdb-secret", keepieUrl, listener);
        console.log("auth keepie response", service, secret, sessionId);
        const getUserResponse = await httpRequest(sessionUrl, {
            auth: `${service}:${secret}`
        });

        if (getUserResponse.statusCode&400 == 400) {
            return res.status(400).send("<h1>bad input</h1>");
        }

        const body = await getUserResponse.body();
        const [error, data] = await Promise.resolve([undefined, JSON.parse(body)]).catch(e => [e]);

        if (error !== undefined) {
            return res.setStatus(400).send("<h1>bad login</h1>");
        }

        const [{created,email:sessionEmail}] = data;
        if (sesionEmail != email) {
            return res.setStatus(400).send("<h1>bad login</h1>");
        }

        // Logged in!
        next();
    }

    // App routes
    app.get("/issue", auth, function (req, res) {
        res.sendFile(path.join(__dirname, "index.html"));
    });

    app.post("/login", formHandler, async function (req, res) {
        console.log("login", req.body);
        const {email, password: plainPassword} = req.body;
        try {
            const keepieUrl = `http://${crankerEndpoint}/userdb/keepie/write/request`;
            const userDetailsUrl = `http://${crankerEndpoint}/userdb/user/${email}`;

            const {service, secret} = await app.keepieResponse("/userdb-secret", keepieUrl, listener);
            const getUserResponse = await httpRequest(userDetailsUrl, {
                auth: `${service}:${secret}`
            });

            if (getUserResponse.statusCode&400 == 400) {
                return res.status(400).send("<h1>bad input</h1>");
            }

            const body = await getUserResponse.body();

            console.log("data", await Promise.resolve([undefined, JSON.parse(body)]).catch(e => [e]));

            const [error, [{password:passwordHashed}]]
                  = await Promise.resolve([undefined, JSON.parse(body)]).catch(e => [e]);
            if (error !== undefined) {
                return res.setStatus(400).send("<h1>bad user</h1>");
            }

            const passwordMatched = await new Promise((resolve, reject) => {
                bcrypt.compare(plainPassword, passwordHashed, function(err, isMatch) {
                    if (err) reject(err);
                    else resolve(isMatch);
                });
            });

            if (!passwordMatched) {
                return res.status(400).send("<h1>bad username or password</h1>");
            }

            // Create a session id
            const sessionId = await new Promise((resolve, reject) => {
                bcrypt.hash(`${email}:${new Date().valueOf()}`, null, null, function(err, hash) {
                    if (err) reject(err);
                    else resolve(hash);
                });
            });
            const sessionStruct = {
                action: "session",
                sessionid: sessionId,
                email: email
            };
            const logUrl = `http://${crankerEndpoint}/userdb/log`;
            const storeSessionResponse = await httpRequest(logUrl, {
                method: "POST",
                auth: `${service}:${secret}`,
                headers: { "content-type": "application/json" },
                requestBody: JSON.stringify(sessionStruct)
            });
            if (storeSessionResponse.statusCode&400 == 400) {
                return res.status(400).send("<h1>cannot create a session</h1>");
            }
            res.cookie("sesh", `${email}:${sessionId}`);
            res.send("<h1>yay! you logged in</h1>");
        }
        catch (e) {
            console.log(e.stack);
            return res.status(400).send(`<h1>errrrrrror ${e}</h1>`);
        }
    });

    app.get("/issue/top", async (req, res) => {
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

    app.get("/user/all", async (req, res) => {
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

    app.post("/user", formHandler, async function (req, res) {
        const keepieUrl = `http://${crankerEndpoint}/userdb/keepie/write/request`;
        try {
            const {email, username, password:clearPassword} = req.body;
            const passwordHash = await new Promise((resolve, reject) => {
                bcrypt.hash(clearPassword, null, null, function(err, hash) {
                    if (err) reject(err);
                    else resolve(hash);
                });
            });

            const struct = {
                action: "create",
                email: email,
                username: username,
                password: passwordHash
            };

            const logUrl = `http://${crankerEndpoint}/userdb/log`;
            const {service, secret} = await app.keepieResponse("/userdb-secret", keepieUrl, listener);
            const response = await httpRequest(logUrl, {
                method: "POST",
                auth: `${service}:${secret}`,
                headers: { "content-type": "application/json" },
                requestBody: JSON.stringify(struct)
            });
            
            if (response.statusCode&400 == 400) {
                return res.status(400).send(`userdb post error ${response}`);
            }

            console.log("response status code", response.statusCode);
            
            if (response.statusCode == 200) {
                const body = await response.body();
                const data = JSON.parse(body);
                return res.status(201).json(data);
            }
        }
        catch (e) {
            console.log("error", e);
            return res.status(400).send(`error somewhere in userdb: ${e}`);
        }
        res.status(400).send("unknown error");
    });
    
    app.post("/issue", formHandler, async function (req, res) {
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
