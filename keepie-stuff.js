const httpRequestObject = require("./http-v2.js");
const multer = require("multer");
const upload = multer();


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

    app.keepieResponse = async function (path, keepieUrl, listener) {
        const {service, secret} = await new Promise(async (Kresolve, Kreject) => {
            const localPort = listener.address().port;
            const localAddress = `http://localhost:${localPort}`;
            const receiptUrl = localAddress + path;
            const keepieResponse = await httpRequestObject(keepieUrl, {
                method: "POST",
                headers: { "x-receipt-url": receiptUrl }
            });
            // FIXME - should check keepie response for 204
            console.log("keepie response", path, keepieResponse);
            const queue = getOrCreateQueue(path);
            queue.push(Kresolve);
        });
        console.log("AFTER AWAIT");
        return {service:service, secret:secret};
    }
}

module.exports = init;

// End
