const pgLogApi = require("pg-log-api");
const path = require("path");
const crankerConnect = require("cranker-connector");

exports.boot = async function (port) {
    if (process.env["USERDB_KEEPIE_WRITE"] === undefined) {
        console.log("setting USERDB_KEEPIE_WRITE");
        process.env["USERDB_KEEPIE_WRITE"] = path.join(__dirname, "authorized-urls-write.json");
    }

    if (process.env["USERDB_KEEPIE_READONLY"] === undefined) {
        process.env["USERDB_KEEPIE_READONLY"] = path.join(__dirname, "authorized-urls-readonly.json");
    }

    const [app, listener, dbConfigPromise] = await pgLogApi.main(port, {
        prefix: "userdb",
        dbDir: path.join(__dirname, "user-dbdir"),
        keepieAuthorizedForWriteEnvVar: "USERDB_KEEPIE_WRITE",
        keepieAuthorizedForReadOnlyEnvVar: "USERDB_KEEPIE_READONLY",
        keepieTime: 1000
    });
    const dbConfig = await dbConfigPromise;

    app.get("/userdb/users", async (req, res) => {
        console.log("issue request");
        const issueRs = await app.db.query("select * from \"user\" order by last_update desc");
        res.json(issueRs.rows);
    });
    
    const crankerRouterVar = process.env["CRANKER_ROUTERS"];
    if (crankerRouterVar !== undefined) {
        const crankerRouters = crankerRouterVar.split(",");
        if (crankerRouters.length > 0) {
            const servicePort = listener.address().port;
            const routerCluster = await crankerConnect(
                crankerRouters, "userdb", `http://localhost:${servicePort}`, {
                    _do_untls: true
                }
            );
        }
    }
    return listener;
}

if (require.main === module) {
    const port = process.argv[2];
    exports.boot(port).then(listener => {
        console.log("listening on", listener.address().port);
    });
}

// End
