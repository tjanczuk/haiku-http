var request = require('request')
	, assert = require('assert')

describe('205_samples_console.js:', function () {
	it('http://localhost?x-haiku-handler=http://localhost:8000/console returns Hello, World!', function (done) {
		request('http://localhost?x-haiku-handler=http://localhost:8000/console', function (err, res, body) {
			assert.ifError(err)
			assert.equal(res.statusCode, 200)
			assert.equal(body, 'Hello, world!\n')
			done()
		})		
	})

	it('http://localhost?x-haiku-handler=http://localhost:8000/console&x-haiku-console=body returns console output in the body', function (done) {
		request('http://localhost?x-haiku-handler=http://localhost:8000/console&x-haiku-console=body', function (err, res, body) {
			assert.ifError(err)
			assert.equal(res.statusCode, 200)
			assert.equal(body, 'Before writeHead\nAfter writeHead and before write\nAfter write and before end\n')
			done()
		})		
	})

	it('http://localhost?x-haiku-handler=http://localhost:8000/console&x-haiku-console=header returns console output in the header and Hello, world! in the boxy', function (done) {
		request('http://localhost?x-haiku-handler=http://localhost:8000/console&x-haiku-console=header', function (err, res, body) {
			assert.ifError(err)
			assert.equal(res.statusCode, 200)
			assert.equal(res.headers['x-haiku-console'], 'Before writeHead%0A')
			assert.equal(body, 'Hello, world!\n')
			done()
		})		
	})

	it('http://localhost?x-haiku-handler=http://localhost:8000/console&x-haiku-console=trailer returns console output in the trailer and Hello, world! in the boxy', function (done) {
		request('http://localhost?x-haiku-handler=http://localhost:8000/console&x-haiku-console=trailer', function (err, res, body) {
			assert.ifError(err)
			assert.equal(res.statusCode, 200)
			assert.equal(res.headers['trailer'], 'x-haiku-console')
			assert.equal(res.trailers['x-haiku-console'], 'Before writeHead%0AAfter writeHead and before write%0AAfter write and before end%0A')
			assert.equal(body, 'Hello, world!\n')
			done()
		})		
	})
})
