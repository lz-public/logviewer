var fs = require('fs');
var fetch = require('node-fetch');
const { Worker, isMainThread, parentPort } = require('worker_threads');
const { file } = require('mock-fs/lib/filesystem');

var DEFAULT_LOG_DIR = '/var/log/';
const DEFAULT_LOCALHOST_LABEL = 'local';

/*
 * scanRemote: looks for a log in a remote server
 *
 * Options: Object with the following properties:
 *   {
 *     host: <IP or host name>:<port> (string)
 *     filename: the log file name (string)
 *     numberOfLines: max results to be returned (int, max configured in fileScanner.js)
 *     searchString: text to search for (string)
 *   }
 */
const scanRemote = async function (options) {
  return new Promise(function (resolve, reject) {
    let url = 'http://' + options.host + '/file/' + options.filename + '/last/' + options.numberOfLines + '?q=' + options.searchString;
    fetch(url)
      .then(res => res.json())
      .then(json => resolve({
        host: options.host,
        results: json.hosts[0].results
      }))
      .catch(err => reject(err));
  });
};

/*
 * scanFileBackwards: looks for a log in this (local) server
 *
 * Options: Object with the following properties:
 *   {
 *     filename: the log file name (string)
 *     numberOfLines: max results to be returned (int, max configured in fileScanner.js)
 *     searchString: text to search for (string)
 *   }
 */
const scanFileBackwards = async function (options) {
  return new Promise(function (resolve, reject) {
    let n = options.numberOfLines;
    let s = options.searchString;

    // the strategy here is to get all the information for the file first
    // and avoid leaving that responsibility to the worker thread (e.g. to
    // prevent creating a thread when the file doesn't exist)
    fs.open(DEFAULT_LOG_DIR + options.filename, 'r', (err, fd) => {
      if (err) {
        resolve({
          host: DEFAULT_LOCALHOST_LABEL,
          status: 'file_not_found',
          debug: DEFAULT_LOG_DIR + options.filename,
          current: __dirname,
          err: err,
          results: []
        });
        return;
      }

      fs.fstat(fd, (err, stat) => {
        if (err) {
          resolve({
            host: DEFAULT_LOCALHOST_LABEL,
            status: 'stat_error',
            results: []
          });
          return;
        }

        // create a separate worker thread to unblock the main process
        const worker = new Worker('./app/fileScanner.js');

        // collect the log data from the worker
        worker.once('message', (collectedLines) => {
          worker.terminate();
          fs.close(fd, (err) => {
            if (err) {
              reject(err);
              return;
            }
            resolve({
              host: DEFAULT_LOCALHOST_LABEL,
              status: 'resolved',
              results: collectedLines
            });
          });
        });

        // start the search process in the worker
        worker.postMessage({
          fileDescriptor: fd,
          fileSize: stat.size,
          blockSize: stat.blksize,
          numberOfLines: n,
          searchString: s
        });
      });
    });
  });
};

/*
 * go: a function that manages to collect search results from all available sources
 *
 * Looks for the following parameters in the query string:
 *   filename: the name of the log file (string)
 *   numlines: the max amount of results to return (string)
 *   q: the text to be searched (string, optional)
 *   hosts: a list of <host>:<port> separated by comma (peer/target servers)
 */
function go (req, res, next) {
  var filename = req.params.filename;
  var numberOfLines = parseInt(req.params.numlines);
  var searchString = (req.query.q) ? req.query.q : '';
  var hosts = (req.query.h) ? req.query.h.split(',') : [];
  var now = (new Date()).toISOString();

  // setup all the tasks that will run in parallel
  var tasks = [
    { engine: scanFileBackwards, args: { filename, numberOfLines, searchString } }
  ];

  // if there are hosts defined, create a task for each host
  hosts.forEach(h => {
    // process only hosts defs that contains something like a port and an IP address or host name - extremely basic validation
    if (h.indexOf(':') > -1 && h.indexOf('.') > -1) {
      tasks.push(
        { engine: scanRemote, args: { filename, numberOfLines, searchString, host: h } }
      );
    }
  });

  // display in the console what this server is doing
  tasks.forEach(t => {
    console.log(
      now,
      t.args.filename,
      ((t.args.host) || 'local').padEnd(15, ' '),
      t.args.numberOfLines.toString().padStart(3, ' '),
      t.args.searchString
    );
  });

  // run all tasks
  Promise.allSettled(
    tasks.map(t => t.engine(t.args))
  ).then(function (results) {
    // all tasks finished, collect all results
    var scanResult = [];
    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        scanResult.push(result.value);
      }
    });

    // send the response to the client

    res.send({
      filename,
      numberOfLines,
      searchString,
      hosts: scanResult
    });

    next();
  });
}

/*
 * setLogDir: Allows to change the source folder where logs are located. Actually used for testing purposes
 */
function setLogDir (dirname) {
  DEFAULT_LOG_DIR = dirname;
}

module.exports = {
  go,
  setLogDir
};
