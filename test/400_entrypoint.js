var request = require('request')
	, assert = require('assert')

describe('400_entrypoint.js:', function () {
	it('http://localhost?x-haiku-handler=http://localhost:8000/tests/entrypoint_setInterval is sandboxed', function (done) {
		request('http://localhost?x-haiku-handler=http://localhost:8000/tests/entrypoint_setInterval', function (err, res, body) {
			assert.ifError(err)
			assert.equal(res.statusCode, 200)
			var result = JSON.parse(body)
			assert.equal(result[0], result[1])
			assert.ok(0 < result[0].indexOf('#'))
			assert.equal(result[0].substring(result[0].indexOf('#') + 1), 'http://localhost:8000/tests/entrypoint_setInterval')
			done()
		})		
	})

	it('http://localhost?x-haiku-handler=http://localhost:8000/tests/entrypoint_setTimeout is sandboxed', function (done) {
		request('http://localhost?x-haiku-handler=http://localhost:8000/tests/entrypoint_setTimeout', function (err, res, body) {
			assert.ifError(err)
			assert.equal(res.statusCode, 200)
			var result = JSON.parse(body)
			assert.equal(result[0], result[1])
			assert.ok(0 < result[0].indexOf('#'))
			assert.equal(result[0].substring(result[0].indexOf('#') + 1), 'http://localhost:8000/tests/entrypoint_setTimeout')
			done()
		})		
	})

	it('http://localhost?x-haiku-handler=http://localhost:8000/tests/entrypoint_nextTick is sandboxed', function (done) {
		request('http://localhost?x-haiku-handler=http://localhost:8000/tests/entrypoint_nextTick', function (err, res, body) {
			assert.ifError(err)
			assert.equal(res.statusCode, 200)
			var result = JSON.parse(body)
			assert.equal(result[0], result[1])
			assert.ok(0 < result[0].indexOf('#'))
			assert.equal(result[0].substring(result[0].indexOf('#') + 1), 'http://localhost:8000/tests/entrypoint_nextTick')
			done()
		})		
	})

	it('http://localhost?x-haiku-handler=http://localhost:8000/tests/entrypoint_EventEmitter is sandboxed (using MongoDB)', function (done) {
		request('http://localhost?x-haiku-handler=http://localhost:8000/tests/entrypoint_EventEmitter', function (err, res, body) {
			assert.ifError(err)
			assert.equal(res.statusCode, 200)
			var result = JSON.parse(body)
			for (var i = 1; i < result.length; i++)
				assert.equal(result[0], result[i])
			assert.ok(0 < result[0].indexOf('#'))
			assert.equal(result[0].substring(result[0].indexOf('#') + 1), 'http://localhost:8000/tests/entrypoint_EventEmitter')
			done()
		})		
	})
})
