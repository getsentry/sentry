var fs = require('fs');
var StackTrace = require('stacktrace-js');
var normalError = require('./test.js');
var minifiedError = require('./test.min.js');

function dumpSentryStacktrace(frames) {
  var newFrames = [];

  frames.forEach(function(frame) {
    var match = frame.fileName.match(/^.*\/(test(\.min)?\.js)$/);
    if (!match) {
      return;
    }
    newFrames.push({
      abs_path: 'http://example.com/static/' + match[1],
      filename: match[1],
      function: frame.functionName,
      lineno: frame.lineNumber,
      colno: frame.columnNumber
    });
  });

  return JSON.stringify(newFrames, null, 2) + '\n';
}

function triggerError(func, fn) {
  try {
    func();
  } catch (e) {
    StackTrace.fromError(e).then(function(stack) {
      fs.writeFile(fn, dumpSentryStacktrace(stack), function() {});
    });
  }
}

triggerError(normalError, 'normalError.json');
triggerError(minifiedError, 'minifiedError.json');
