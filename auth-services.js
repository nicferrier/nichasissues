const path = require("path");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt-nodejs");
const httpRequest = require("./http-v2.js");
const cookieParser = require("cookie-parser");

async function initAuth(listener, crankerEndpoint, app) {
    const formHandler = bodyParser.urlencoded({extended: true});

    return {
        middleware: async function(req, res, next) {
            try {
                const [email, sessionId] = req.cookies.sesh.split(":");
                const keepieUrl = `http://${crankerEndpoint}/userdb/keepie/write/request`;
                const sessionUrl = `http://${crankerEndpoint}/userdb/session/${sessionId}`;

                const {service, secret} = await app.keepieResponse("/userdb-secret", keepieUrl, listener);
                const getUserResponse = await httpRequest(sessionUrl, {
                    auth: `${service}:${secret}`
                });

                if (getUserResponse.statusCode&400 == 400) {
                    return res.status(400);
                }

                const body = await getUserResponse.body();
                const [error, data] = await Promise.resolve([undefined, JSON.parse(body)]).catch(e => [e]);

                if (error !== undefined) {
                    return res.status(400);
                }

                const [{created, email:sessionEmail}] = data;
                if (sessionEmail != email) {
                    return res.status(400);
                }

                // Logged in!
                next();
            }
            catch (e) {
                console.log("auth middleware error", e.stack);
                res.status(400);
                res.send();
            }
        },

        login: async function (req, res, next) {
            await new Promise((resolve, reject) => {
                formHandler(req, res, function () {
                    resolve();
                });
            });

            const {email, password: plainPassword} = req.body;
            try {
                const keepieUrl = `http://${crankerEndpoint}/userdb/keepie/write/request`;
                const userDetailsUrl = `http://${crankerEndpoint}/userdb/user/${email}`;

                const {service, secret} = await app.keepieResponse("/userdb-secret", keepieUrl, listener);
                const getUserResponse = await httpRequest(userDetailsUrl, {
                    auth: `${service}:${secret}`
                });

                if (getUserResponse.statusCode&400 == 400) {
                    res.status(400).send("<h1>bad input</h1>");
                    return next();
                }

                const body = await getUserResponse.body();
                const [error, [{password:passwordHashed}]]
                      = await Promise.resolve([undefined, JSON.parse(body)]).catch(e => [e]);
                if (error !== undefined) {
                    res.loginError = "bad user";
                    res.setStatus(400);
                    return next();
                }

                const passwordMatched = await new Promise((resolve, reject) => {
                    bcrypt.compare(plainPassword, passwordHashed, function(err, isMatch) {
                        if (err) reject(err);
                        else resolve(isMatch);
                    });
                });

                if (!passwordMatched) {
                    res.loginError = "password not matched";
                    res.status(400);
                    return next();
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
                    res.loginError = "cannot create a session";
                    res.status(400);
                    return next();
                }

                res.cookie("sesh", `${email}:${sessionId}`);
                res.status = 200;
                return next();
            }
            catch (e) {
                console.log("login handler error", e.stack);
                res.loginError = e.message;
                res.status(400);
                return next();
            }
        },

        register: async function (req, res) {
            await new Promise((resolve, reject) => {
                formHandler(req, res, function () {
                    resolve();
                });
            });

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
                console.log("register handler error", e.stack);
                return res.status(400).send(`error somewhere in userdb: ${e}`);
            }
            res.status(400).send("unknown error");
        }
    };
}

module.exports = initAuth;

// End
