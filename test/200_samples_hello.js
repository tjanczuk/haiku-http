var request = require('request')
	, assert = require('assert')

describe('200_samples_hello.js:', function () {
	it('http://localhost?x-haiku-handler=http://localhost:8000/hello returns Hello, world!', function (done) {
		request('http://localhost?x-haiku-handler=http://localhost:8000/hello', function (err, res, body) {
			assert.ifError(err)
			assert.equal(res.statusCode, 200)
			assert.equal(body, 'Hello, world!\n')
			done()
		})
	})
})
