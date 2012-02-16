// Write to the console and access console output.
//
// Try the following scenarios:
// 
// Console output is ignored (default):
// ?x-haiku-handler=https://raw.github.com/tjanczuk/haiku-http/master/samples/haikus/console.js
//
// Console output up until the end() call is returned in the body of the HTTP response instead of the actual body:
// ?x-haiku-handler=https://raw.github.com/tjanczuk/haiku-http/master/samples/haikus/console.js&x-haiku-console=body
//
// Console output up until writeHead() call is returned in the x-haiku-console HTTP response header:
// ?x-haiku-handler=https://raw.github.com/tjanczuk/haiku-http/master/samples/haikus/console.js&x-haiku-console=header
//
// Console output up until end() call is returned in the x-haiku-console HTTP response trailer:
// ?x-haiku-handler=https://raw.github.com/tjanczuk/haiku-http/master/samples/haikus/console.js&x-haiku-console=body
// (one way to view this one is with curl --trace -)

console.log('Before writeHead');
res.writeHead(200);
console.log('After writeHead and before write');
res.write('Hello, ');
console.log('After write and before end');
res.end('world!\n');
console.log('After end');