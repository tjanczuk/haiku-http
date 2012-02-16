// Make outgoing HTTPS request through an HTTP proxy for Github's home page and relay it back as a response.
// You must specify the proxy_host and proxy_port query parameters describing your HTTP proxy, e.g:
//
// ?x-haiku-handler=https://raw.github.com/tjanczuk/haiku-http/master/samples/haikus/proxied-https.js&proxy_host=itgproxy&proxy_port=80

var query = require('url').parse(req.url, true).query

if (!query.proxy_host || !query.proxy_port)
    throw new Error('The proxy_host and proxy_port URL query parameters must specify the HTTP proxy.')

var http = require('http')
    , https = require('https')

res.writeHead(200);

http.request({ // establishing a tunnel
    host: query.proxy_host,
    port: query.proxy_port,
    method: 'CONNECT',
    path: 'github.com:443'
}).on('connect', function(pres, socket, head) {
    if (pres.statusCode !== 200) 
        res.end('Proxy response status code: ' + pres.statusCode);
    else 
        https.get({
            host: 'github.com',
            socket: socket, // using a tunnel
            agent: false    // cannot use a default agent
        }, function (bres) {
            bres.pipe(res);
        }).on('error', function (err) {
            res.end('Error talking to backend: ' + err);
        });
}).on('error', function (err) {
    res.end('Error talking to proxy: ' + err);
}).end();