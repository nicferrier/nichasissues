const http = require("http");
const url = require("url");
const stream = require("stream");

const httpRequest = async function (targetUrl, options={}) {
    const {method="GET", auth, headers, requestBody} = options;
    const urlObj = url.parse(targetUrl);
    const {hostname, port: targetPort, path} = urlObj;
    const request = {
        method: method,
        host: hostname,
        port: targetPort,
        path: path
    };
    const authedRequest = (auth !== undefined) ? Object.assign({auth:auth}, request) : request;
    const headeredRequest = (headers !== undefined) ? Object.assign({headers: headers}, authedRequest) : authedRequest;
    console.log("httptx", targetUrl, headeredRequest);
    const response = new Promise((resolve, reject) => {
        const httpTx = http.request(headeredRequest, response => {
            console.log("httptx", targetUrl, response.statusCode);
            const returnObject = {
                statusCode: response.statusCode,
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
};

module.exports = httpRequest;

// End
