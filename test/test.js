var assert = require('assert');
var logFetch = require('../app/logFetch.js');
// const mock = require('mock-fs');
const { stdout } = require('process');
const { fstat } = require('fs');

// mock the response object
var res = { output: 'abc', send: function (x) { this.output = x; } };

describe('Local file processor', function () {
  it('find some logs', function (done) {
    let req = {
      params: { filename: 'mock-test.log', numlines: '5' },
      query: { q: 'Tue', h: '' }
    };
    logFetch.setLogDir('test/');
    logFetch.go(req, res, function (done) {
      assert.strict.equal(res.output.filename, 'mock-test.log');
      assert.strict.equal(res.output.hosts[0].results.length, 5);
      assert.strict.equal(res.output.hosts[0].results[3], 'Tue Aug  4 19:48:53.985 Weight: 3.1336');
    });
    done();
  });

  it('find only 3 results', function (done) {
    let req = {
      params: { filename: 'mock-test.log', numlines: '3' },
      query: { q: 'Tue', h: '' }
    };
    logFetch.setLogDir('test/');
    logFetch.go(req, res, function (done) {
      assert.strict.equal(res.output.hosts[0].results.length, 3);
    });
    done();
  });

  it('search for a non-existent string', function (done) {
    let req = {
      params: { filename: 'mock-test.log', numlines: '3' },
      query: { q: 'NothingThere', h: '' }
    };
    logFetch.setLogDir('test/');
    logFetch.go(req, res, function (done) {
      assert.strict.equal(res.output.filename, 'mock-test.log');
      assert.strict.equal(res.output.hosts[0].results.length, 0);
    });
    done();
  });

  it('find something in the first line of the log', function (done) {
    let req = {
      params: { filename: 'mock-test.log', numlines: '30' },
      query: { q: 'CachedScanRecord', h: '' }
    };
    logFetch.setLogDir('test/');
    logFetch.go(req, res, function (done) {
      assert.strict.equal(res.output.hosts[0].results.length, 1);
    });
    done();
  });

  it('make sure the previous test was correct', function (done) {
    let req = {
      params: { filename: 'mock-test.log', numlines: '0' },
      query: { q: 'CachedScanRecord', h: '' }
    };
    logFetch.setLogDir('test/');
    logFetch.go(req, res, function (done) {
      assert.strict.equal(res.output.hosts[0].results.length, 0);
    });
    done();
  });

  it('find something in the last line', function (done) {
    let req = {
      params: { filename: 'mock-test.log', numlines: '2' },
      query: { q: 'Weight: 2.7311', h: '' }
    };
    logFetch.setLogDir('test/');
    logFetch.go(req, res, function (done) {
      assert.strict.equal(res.output.hosts[0].results.length, 1);
    });
    done();
  });

  it('get all lines of the log', function (done) {
    let req = {
      params: { filename: 'mock-test.log', numlines: '20' },
      query: { q: 'Tue Aug', h: '' }
    };
    logFetch.setLogDir('test/');
    logFetch.go(req, res, function (done) {
      assert.strict.equal(res.output.hosts[0].results.length, 17);
    });
    done();
  });
});
