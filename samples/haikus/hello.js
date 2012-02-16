// Returns Hello, world in the response body
//
// ?x-haiku-handler=https://raw.github.com/tjanczuk/haiku-http/master/samples/haikus/hello.js

res.writeHead(200)
res.end('Hello, world!\n')