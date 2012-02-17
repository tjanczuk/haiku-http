
// Use 'request' module to fetch http://reuters.com page and count the number of times
// a specified word shows up on it. 
//
// You can specify the word to count using the "word" URL query parameter. "the" is assumed when no word is specified.
// You can also specify the proxy_host and proxy_port query parameters describing your HTTP proxy if you have one.
//
// Return the count of the "economy" word without using an HTTP proxy:
// ?x-haiku-handler=https://raw.github.com/tjanczuk/haiku-http/master/samples/haikus/request.js&word=economy
//
// Return the count of the "economy" word without using itgproxy:80 HTTP proxy:
// ?x-haiku-handler=https://raw.github.com/tjanczuk/haiku-http/master/samples/haikus/request.js&word=economy&proxy_host=itgproxy&proxy_port=80

var query = require('url').parse(req.url, true).query
var word = query.word || 'the'

var request = require('request')

if (query.proxy_host && query.proxy_port)
    request = request.defaults({ proxy: 'http://' + query.proxy_host + ':' + query.proxy_port })

request('http://www.reuters.com', function (error, response, body) {
	if (error || response.statusCode !== 200) {
		res.writeHead(500)
		res.end('Unexpected error getting http://reuters.com.\n')
	}
	else {
		var count = 0, index = 0
		while (0 !== (index = (body.indexOf(word, index) + 1)))
			count++
		res.writeHead(200)
		res.end('Number of times the word "' + word + '" occurs on http://reuters.com is: ' + count + '\n')
	}
})