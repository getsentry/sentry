const fs = require('fs');
const puppeteer = require('puppeteer');
const stacktraceParser = require('stacktrace-parser');

function convertStack(frames) {
  return frames.map((item) => {
    var match = item.file.match(/^.*\/(.*?)$/);
    var fileName, absPath;
    if (match && match[1]) {
      fileName = match[1];
      absPath = 'http://example.com/' + fileName;
    } else {
      fileName = absPath = item.file;
    }
    return {
      abs_path: absPath,
      filename: fileName,
      lineno: item.lineNumber,
      colno: item.column,
      'function': item.methodName,
    };
  });
}

(async() => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto('file://' + __dirname + '/index.html');
  const stack = await page.evaluate('produceStack()');
  const frames = convertStack(stacktraceParser.parse(stack));
  frames.pop();
  const stackDump = JSON.stringify(frames, null, 2) + '\n';
  fs.writeFile('minifiedError.json', stackDump, function() {
    browser.close();
  });
})();
