const pgLogApi = require("pg-log-api");
const path = require("path");

exports.boot = async function (port) {
    if (process.env["USERDB_KEEPIE_WRITE"] === undefined) {
        console.log("setting USERDB_KEEPIE_WRITE");
        process.env["USERDB_KEEPIE_WRITE"] = path.join(__dirname, "authorized-urls-write.json");
    }

    if (process.env["USERDB_KEEPIE_READONLY"] === undefined) {
        process.env["USERDB_KEEPIE_READONLY"] = path.join(__dirname, "authorized-urls-readonly.json");
    }

    const [app, listener, dbConfigPromise] = await pgLogApi.main(port, {
        dbDir: path.join(__dirname, "user-dbdir"),
        keepieAuthorizedForWriteEnvVar: "USERDB_KEEPIE_WRITE",
        keepieAuthorizedForReadOnlyEnvVar: "USERDB_KEEPIE_READONLY",
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
