var request = require('request')
	, assert = require('assert')

describe('204_samples_request.js:', function () {
	it('http://localhost?x-haiku-handler=http://localhost:8000/request returns results for "the" word', function (done) {
		request('http://localhost?x-haiku-handler=http://localhost:8000/request', function (err, res, body) {
			assert.ifError(err)
			assert.equal(res.statusCode, 200)
			assert.ok(body.indexOf('"the"') !== -1)
			done()
		})		
	})

	it('http://localhost?x-haiku-handler=http://localhost:8000/request&word=economy returns results for "economy" word', function (done) {
		request('http://localhost?x-haiku-handler=http://localhost:8000/request&word=economy', function (err, res, body) {
			assert.ifError(err)
			assert.equal(res.statusCode, 200)
			assert.ok(body.indexOf('"economy"') !== -1)
			done()
		})		
	})
})
