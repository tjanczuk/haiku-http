var request = require('request')
	, assert = require('assert')

describe('202_samples_mongo.js:', function () {
	it('http://localhost?x-haiku-handler=http://localhost:8000/mongo returns two documents', function (done) {
		request('http://localhost?x-haiku-handler=http://localhost:8000/mongo', function (err, res, body) {
			assert.ifError(err)
			assert.equal(res.statusCode, 200)
			assert.ok(body.indexOf('app1.com') !== -1)
			assert.ok(body.indexOf('app2.com') !== -1)
			done()
		})		
	})

	it('http://localhost?x-haiku-handler=http://localhost:8000/mongo&host=app1.com returns one document for app1.com', function (done) {
		request('http://localhost?x-haiku-handler=http://localhost:8000/mongo&host=app1.com', function (err, res, body) {
			assert.ifError(err)
			assert.equal(res.statusCode, 200)
			assert.ok(body.indexOf('app1.com') !== -1)
			assert.ok(body.indexOf('app2.com') === -1)
			done()
		})		
	})

	it('http://localhost?x-haiku-handler=http://localhost:8000/mongo&host=app2.com returns one document for app2.com', function (done) {
		request('http://localhost?x-haiku-handler=http://localhost:8000/mongo&host=app2.com', function (err, res, body) {
			assert.ifError(err)
			assert.equal(res.statusCode, 200)
			assert.ok(body.indexOf('app1.com') === -1)
			assert.ok(body.indexOf('app2.com') !== -1)
			done()
		})		
	})

	it('http://localhost?x-haiku-handler=http://localhost:8000/mongo&host=foobar returns no documents', function (done) {
		request('http://localhost?x-haiku-handler=http://localhost:8000/mongo&host=foobar', function (err, res, body) {
			assert.ifError(err)
			assert.equal(res.statusCode, 200)
			assert.ok(body.indexOf('app1.com') === -1)
			assert.ok(body.indexOf('app2.com') === -1)
			done()
		})		
	})
})
