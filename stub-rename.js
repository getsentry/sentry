const fs = require('fs');
const child = require('child_process');

const results = child
  .execSync("find . -type f -name '*.spec.tsx' -exec grep -lH 'TestStubs' {}  \\;")
  .toString();

const files = results.split('\n');

function lowercasefirst(string) {
  return string.charAt(0).toLowerCase() + string.slice(1);
}

for (const file of files) {
  if (!file) {
    continue;
  }

  let content = fs.readFileSync(file, 'utf8');

  const imports = new Set();

  let matches;
  while ((matches = /TestStubs\.([^\(]+)/g.exec(content))) {
    imports.add(matches[1]);
    content = content.replaceAll(new RegExp(`TestStubs.(${matches[1]})`, 'g'), '$1');
    matches = /TestStubs\.([^\(]+)/g.exec(content);
  }

  const contentByLine = content.split('\n');
  for (const importName of imports) {
    contentByLine.unshift(
      `import {${importName}} from 'fixtures/js-stubs/${lowercasefirst(importName)}';`
    );

    fs.writeFileSync(file, contentByLine.join('\n'), 'utf8');
  }
}
