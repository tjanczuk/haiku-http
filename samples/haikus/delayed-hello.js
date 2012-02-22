// Returns Hello, world in the response body in two parts, the second one delayed by 1 second.
//
// ?x-haiku-handler=https://raw.github.com/tjanczuk/haiku-http/master/samples/haikus/delayed-hello.js

res.writeHead(200)
res.write(new Date() + ': Hello, \n')
setTimeout(function () {
	res.end(new Date() + ': world!\n')
}, 1000)