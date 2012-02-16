// Make outgoing HTTPS request for Github's home page and relay it back as a response.
//
// ?x-haiku-handler=https://raw.github.com/tjanczuk/haiku-http/master/samples/haikus/https.js

require('https').get({ host: 'github.com' }, function (bres) {
    res.writeHead(bres.statusCode)
    bres.pipe(res)
}).on('error', function (err) {
    res.writeHead(500)
    res.end('Error talking to backend: ' + err)
})