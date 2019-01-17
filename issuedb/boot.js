const pgLogApi = require("pg-log-api");
const path = require("path");
const crankerConnect = require("cranker-connector");

exports.boot = async function (port) {
    if (process.env["ISSUEDB_KEEPIE_WRITE"] === undefined) {
        console.log("setting ISSUEDB_KEEPIE_WRITE");
        process.env["ISSUEDB_KEEPIE_WRITE"] = path.join(__dirname, "authorized-urls-write.json");
    }

    if (process.env["ISSUEDB_KEEPIE_READONLY"] === undefined) {
        process.env["ISSUEDB_KEEPIE_READONLY"] = path.join(__dirname, "authorized-urls-readonly.json");
    }

    const [app, listener, dbConfigPromise] = await pgLogApi.main(port, {
        prefix: "issuedb",
        dbDir: path.join(__dirname, "issue-dbdir"),
        keepieAuthorizedForWriteEnvVar: "ISSUEDB_KEEPIE_WRITE",
        keepieAuthorizedForReadOnlyEnvVar: "ISSUEDB_KEEPIE_READONLY",
        keepieTime: 1000
    });
    const dbConfig = await dbConfigPromise;

    app.get("/issuedb/issue", dbConfig.keepieAdvertMiddleware, async (req, res) => {
        const issueRs = await app.db.query(
            "select * from issue where state='OPEN' order by last_update desc"
        );
        res.json(issueRs.rows);
    });

    const crankerRouterVar = process.env["CRANKER_ROUTERS"];
    if (crankerRouterVar !== undefined) {
        const crankerRouters = crankerRouterVar.split(",");
        if (crankerRouters.length > 0) {
            const servicePort = listener.address().port;
            console.log("cranker connecting to routers", crankerRouters);
            const routerCluster = await crankerConnect(
                crankerRouters, "issuedb", `http://localhost:${servicePort}`, {
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
