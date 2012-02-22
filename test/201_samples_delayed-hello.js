var request = require('request')
	, assert = require('assert')

describe('201_samples_delayed-hello.js:', function () {
	it('http://localhost?x-haiku-handler=http://localhost:8000/delayed-hello returns Hello, world in two lines', function (done) {
		request('http://localhost?x-haiku-handler=http://localhost:8000/delayed-hello', function (err, res, body) {
			assert.ifError(err)
			assert.equal(res.statusCode, 200)
			assert.ok(body.indexOf('Hello') !== -1)
			assert.ok(body.indexOf('world') !== -1)
			done()
		})		
	})
})