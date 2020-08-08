var fs = require('fs');
const { Worker, isMainThread, parentPort } = require('worker_threads');

const MAX_RESULTS = 50;

/*
 * Listener on messages sent by the parent thread
 *
 * Options: An object with the folowing properties:
 *    {
 *      fileDescriptor: a file descriptor provided by fs.open(),
 *      fileSize: file size,
 *      blockSize: optimal chunk size to read,
 *      numberOfLines: maximum number of results to return,
 *      searchString: the query/search string
 *    }
 */
parentPort.on('message', (options) => {
  var collectedLines = [];
  let endPosition = parseInt(options.fileSize);
  let blockSize = Math.min(parseInt(options.blockSize), endPosition);
  let startPosition = Math.max(0, endPosition - blockSize);
  let numberOfLines = Math.min(parseInt(options.numberOfLines), MAX_RESULTS);
  let searchString = options.searchString.trim();
  let partToAddToNextChunk = '';

  while ((startPosition >= 0 && endPosition > 0) && collectedLines.length < numberOfLines) {
    let someData = getChunk(options.fileDescriptor, startPosition, blockSize);

    // if there was some data from the next chunk (we're reading backwards), add it to the current chunk
    someData += partToAddToNextChunk;
    partToAddToNextChunk = '';

    // split the data in lines
    let lines = someData.split('\n');

    // if the file pointer not in the beginning of the file, maybe we're reading part of a line that
    // belongs to the chunk that is before this (the next chunk we'll read)
    if (startPosition > 0) {
      partToAddToNextChunk = lines[0];
      lines.shift();
    }

    // first keep only relevant results, then reverse (smaller array)
    lines = lines.filter(line => lineSearch(line, searchString).length > 0);
    lines.reverse();

    // move pointers back
    startPosition -= blockSize;
    endPosition = startPosition + blockSize;

    // add results to our collection
    lines.forEach(function (l) {
      if (collectedLines.length < numberOfLines && l.trim() !== '') collectedLines.push(l);
    });
  }

  // send the results to the parent process
  parentPort.postMessage(collectedLines);
});

/*
 *  getChunk: reads a part of a file using syncronous (blocking) calls, since this is running
 *            as a worker thread and we don't get any benefit by doing this ansynchronously
 *
 * Vars:
 * fileDescriptor: a file descriptor created by fs.open()
 * start: first byte to read (int)
 * length: the buffer size (int)
 */
function getChunk (fileDescriptor, start, length) {
  if (start < 0) start = 0;
  if (length <= 0) return '';

  let buffer = Buffer.alloc(length, 0);
  fs.readSync(fileDescriptor, buffer, 0, length, start);
  return buffer.toString('ascii');
}

/*
 * lineSearch: handles the "search engine". This implementation could be reduced to a single line
 *             of code. However, the idea here is to implement a complete search interpreter
 *
 * Vars:
 * text: the text where we want to find things (string)
 * searchStr: the keyword to search (string)
 */
function lineSearch (text, searchStr) {
  // this version detects only the first occurence of the strng. Possible improvements:
  // 1) detect all occurences to allow highlighting by and array with all starting
  //    positions of the search string.
  // 2) search by keyword
  let pos = text.indexOf(searchStr);
  if (pos > -1) {
    return [pos];
  }
  return [];
}
