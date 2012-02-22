var request = require('request')
	, mongodb = require('mongodb')
	, assert = require('assert')

describe('000_prerequisities.js:', function () {
	describe('haiku-http service', function () {
		it('is running at http://localhost', function (done) {
			request('http://localhost', function (err, res, body) {
				assert.ifError(err)
				assert.equal(res.statusCode, 400)
				done()
			})
		})
	})
	
	describe('haiku-http script service', function () {
		it('is running at http://localhost:8000', function (done) {
			request('http://localhost:8000/hello', function (err, res, body) {
				assert.ifError(err)
				assert.equal(res.statusCode, 200)
				done()
			})
		})
	})	

	describe('direct (non-proxied) internet connection', function () {
		it('is available', function (done) {
			request('http://www.google.com', function (err, res, body) {
				assert.ifError(err)
				assert.equal(res.statusCode, 200)
				done()
			})					
		})
	})

	describe('MonghDB database at mongodb://arr:arr@staff.mongohq.com:10024/arr', function () {
		it('is available', function (done) {
			mongodb.connect('mongodb://arr:arr@staff.mongohq.com:10024/arr', function (err, db) {
				assert.ifError(err)
				db.close()
				done()
			})			
		})
	})
})
