var request = require('request')
	, assert = require('assert')

describe('203_samples_https.js:', function () {
	it('http://localhost?x-haiku-handler=http://localhost:8000/https returns GitHub home page', function (done) {
		request('http://localhost?x-haiku-handler=http://localhost:8000/https', function (err, res, body) {
			assert.ifError(err)
			assert.equal(res.statusCode, 200)
			assert.ok(body.indexOf('GitHub') !== -1)
			done()
		})		
	})
})
