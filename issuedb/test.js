const pgLogApi = require("pg-log-api");
const http = require("http");
const stream = require("stream");
const crypto = require("crypto");
const assert = require("assert");
const path = require("path");


// Copied from issue's id.js
const makeId = function () {
    const hmac = crypto.createHmac('sha256', new Date().toString());
    hmac.update(crypto.randomBytes(16).toString("base64"));
    return hmac.digest("hex");
}

function makeIssuePoster(listener) {
    const port = listener.address().port;
    return async function (issue) {
        const result = await new Promise((resolve, reject) => {
            http.request({
                method: "POST",
                host: "localhost",
                port: port,
                path: "/db/log",
                auth: "log:reallysecret",
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
                        resolve(buffer);
                    }
                }));
            }).end(JSON.stringify(issue));
        });
        return result;
    };
}

async function test() {
    const [app, listener, dbConfigPromise] = await pgLogApi.main(0, {
        dbDir: path.join(__dirname, "test-dbfiles")
    });
    const dbConfig = await dbConfigPromise;

    try {
        const postIssue = makeIssuePoster(listener);
        const reportedDate = new Date().valueOf();
        const issueId = makeId();
        const postResult = await postIssue({
            issueid: issueId,
            reported: reportedDate,
            summary: "the issue system isn't working yet",
            full: "This issue system barely exists as a concept. Let alone as something usable.",
            raisedBy: "nic.ferrier@ferrier.me.uk"
        });
        assert(postResult.length > 0, `postResult should not be empty: ${postResult}`);

        const logResults = await app.db.query("select count(*) from only log");
        assert(logResults.rows[0].count == 0, `log partition table count was ${logResults.rows[0].count} not 0`);

        const d = new Date();
        const [year, month] = [d.getFullYear(), d.getMonth() + 1];
        const tablePartition = `log_${year}${month.toString().padStart(2, "0")}`;
        const logPartResults = await app.db.query(`select * from parts.${tablePartition}`);
        assert(
            logPartResults.rows.length > 0,
            `log partition ${tablePartition} result set row count was ${logPartResults.rows.length} not > 0`
        );

        const issueResults = await app.db.query("select * from issue");
        assert(
            issueResults.rows.length == logPartResults.rows.length,
            `log partition ${tablePartition} result set row count was ${logPartResults.rows.length} 
and not == issue result set count: ${issueResults.rows.length}`
        );

        return [undefined, 0];
    }
    catch (e) {
        console.log("error in the test", e);
        return [e];
    }
    finally {
        listener.close();
        const exitCode = await dbConfig.close();        
    }
}

test().then(([error, ret]) => console.log("test ends", error, ret));

// End
