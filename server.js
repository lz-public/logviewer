/*
 * Log Viewer Demo v 1.0.0
 */

var restify = require('restify');
var logFetch = require('./app/logFetch.js');

var server = restify.createServer();
server.use(restify.plugins.queryParser());
server.get('/', restify.plugins.serveStatic({ directory: './public', default: 'index.html' }));
server.get('/file/:filename/last/:numlines', logFetch.go);
server.head('/file/:filename/last/:numlines', logFetch.go);

server.listen(process.argv[2] || 0, function () {
  console.log('%s listening at %s', server.name, server.url);
});
