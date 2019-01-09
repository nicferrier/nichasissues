const pgLogApi = require("pg-log-api");
const path = require("path");

exports.boot = async function (port) {
    if (process.env["ISSUEDB_KEEPIE_WRITE"] === undefined) {
        console.log("setting ISSUEDB_KEEPIE_WRITE");
        process.env["ISSUEDB_KEEPIE_WRITE"] = path.join(__dirname, "authorized-urls-write.json");
    }

    if (process.env["ISSUEDB_KEEPIE_READONLY"] === undefined) {
        process.env["ISSUEDB_KEEPIE_READONLY"] = path.join(__dirname, "authorized-urls-readonly.json");
    }

    const [app, listener, dbConfigPromise] = await pgLogApi.main(port, {
        dbDir: path.join(__dirname, "issue-dbdir"),
        keepieAuthorizedForWriteEnvVar: "ISSUEDB_KEEPIE_WRITE",
        keepieAuthorizedForReadOnlyEnvVar: "ISSUEDB_KEEPIE_READONLY",
        keepieTime: 1000
    });
    const dbConfig = await dbConfigPromise;

    app.get("/issue", async (req, res) => {
        console.log("issue request");
        const issueRs = await app.db.query("select * from issue order by last_update desc");
        res.json(issueRs.rows);
    });
    return listener;
}

if (require.main === module) {
    const port = process.argv[2];
    exports.boot(port).then(listener => {
        console.log("listening on", listener.address().port);
    });
}

// End
