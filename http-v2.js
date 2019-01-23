const http = require("http");
const url = require("url");
const stream = require("stream");

// call httpRequest, get back a function which can send the request
// the function can be called multiple times and send a different http request each time
// the function can be passed repeated options, more headers

const DEBUG=false;

function httpRequest(targetUrl, options={}) {
    const urlObj = url.parse(targetUrl);
    const {hostname, port: targetPort, path} = urlObj;
    const {method="GET", headers={}, auth, requestBody} = options;

    const request = {
        method: method,
        host: hostname,
        port: targetPort,
        path: path
    };

    const authedRequest = (auth !== undefined)
          ? Object.assign({auth:auth}, request)
          : request;
    const headeredRequest = (headers !== undefined)
          ? Object.assign({headers:headers}, authedRequest)
          : authedRequest;

    if (DEBUG) {
        console.log(`http-v2 ${targetUrl} ${JSON.stringify(headeredRequest)}`);
    }
    const response = new Promise((resolve, reject) => {
        const httpTx = http.request(headeredRequest, response => {
            if (DEBUG) {
                console.log("http-v2", method, targetUrl, response.statusCode);
            }
            const returnObject = {
                request: headeredRequest,
                statusCode: response.statusCode,
                headers: response.headers,
                body: function () {
                    return new Promise((bodyResolve, bodyReject) => {
                        let buffer = "";
                        response.pipe(new stream.Writable({
                            write(chunk, encoding, next) {
                                buffer = buffer + chunk;
                                next();
                            },
                            final(next) {
                                bodyResolve(buffer);
                            }
                        }));
                    });
                }
            };
            resolve(returnObject);
        });

        if (requestBody !== undefined) {
            httpTx.end(requestBody);
        }
        else {
            httpTx.end();
        }
    });
    return response;
}

module.exports = httpRequest;

// End
