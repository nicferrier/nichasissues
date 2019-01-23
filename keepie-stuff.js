const httpRequestObject = require("./http-v2.js");
const multer = require("multer");
const upload = multer();

const DEBUG=false;

function init(app) {
    const resolveQueues = {};
    const getOrCreateQueue = function (path) {
        const existing = resolveQueues[path];
        if (existing !== undefined) {
            return existing;
        }
        else {
            resolveQueues[path] = [];
            return resolveQueues[path];
        }
    };

    app.keepieEndpoint = function (path) {
        const resolveQueue = getOrCreateQueue(path);
        app.post(path, upload.array(), function (req, res) {
            try {
                const {name: serviceName, password} = req.body;
                function send(queue) {
                    if (queue.length < 1) return;
                    // console.log("send", resolveQueues);
                    const resolvable = queue.shift();
                    const value = resolvable({service: serviceName, secret: password});
                    send(queue);
                }
                send(resolveQueue);
                res.sendStatus(204);
            }
            catch (e) {
                res.sendStatus(400);
            }
        });
    };

    const cache = new Map();
    app.keepieResponse = async function (path, keepieUrl, listener, timeOut=5000) {
        const key = `${path}__${keepieUrl}`;
        const cachedPromise = cache.get(key);
        if (cachedPromise !== undefined) {
            if (DEBUG) {
                console.log("CACHE HIT", key);
            }
            return cachedPromise;
        }

        if (DEBUG) {
            console.log("CACHE MISS", key);
        }

        const p = new Promise(async (resolve, reject) => {
            const localPort = listener.address().port;
            const localAddress = `http://localhost:${localPort}`;
            const receiptUrl = localAddress + path;
            const keepieResponse = await httpRequestObject(keepieUrl, {
                method: "POST",
                headers: { "x-receipt-url": receiptUrl }
            });
            // FIXME - should check keepie response for 204
            keepieResponse.statusCode == 204 || reject(new Error(keepieResponse));
            console.log("keepie response", path, keepieResponse);
            const queue = getOrCreateQueue(path);
            let resolved = false;
            queue.push(function (args) {
                resolved = true;
                resolve(args);
            });
            setTimeout(timeEvt => {
                if (resolved == false) {
                    reject(new Error("timed out!"))
                }
            }, timeOut);  // wait 5 seconds
        });
        cache.set(key, p);
        return p;
    }
}

module.exports = init;

// End
