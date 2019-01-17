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
                    console.log("send", resolveQueues);
                    const resolvable = queue.shift();
                    resolvable({service: serviceName, secret: password});
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

    app.keepieResponse = async function (path) {
        const queue = getOrCreateQueue(path);
        const {service, secret} = await new Promise((resolve, reject) => {
            queue.push(resolve);
            console.log("queue looks like", resolveQueues);
        });
        return {service:service, secret:secret};
    }
}

module.exports = init;

// End
