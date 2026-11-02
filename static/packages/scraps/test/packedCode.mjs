// Run against a consumer that has installed the packed Scraps and Icons tarballs:
// node test/packedCode.mjs /absolute/path/to/consumer/package.json
import {spawnSync} from 'node:child_process';
import {dirname, resolve} from 'node:path';

const manifest = process.argv[2];
if (!manifest) {
  throw new Error('Pass the package.json of the installed consumer.');
}
const result = spawnSync(
  process.execPath,
  [
    '--input-type=module',
    '--eval',
    String.raw`
import assert from 'node:assert/strict';
import {CodeBlock, getPrismLanguage, loadPrismLanguage} from '@sentry/scraps/code';
import {lightTheme} from '@sentry/scraps/theme';
import {ThemeProvider} from '@emotion/react';
import {createElement} from 'react';
import {renderToString} from 'react-dom/server';
import Prism from 'prismjs';
assert.equal(getPrismLanguage('TSX?'), 'tsx');
assert.equal(
  Prism.languages.tsx,
  undefined,
  'smoke test must start with an unloaded grammar'
);
let loaded = false;
await loadPrismLanguage('tsx', {
  onLoad: () => {
    loaded = true;
  },
  onError: error => {
    throw error;
  },
});
assert.equal(loaded, true);
assert.ok(Prism.languages.jsx, 'JSX dependency was loaded from the installed package');
assert.ok(
  Prism.languages.typescript,
  'TypeScript dependency was loaded from the installed package'
);
assert.match(
  Prism.highlight('const element = <Button />;', Prism.languages.tsx, 'tsx'),
  /token tag/
);

let failed = false;
await loadPrismLanguage('unknown-language', {
  suppressExistenceWarning: true,
  onError: () => {
    failed = true;
  },
});
assert.equal(failed, true);
const html = renderToString(
  createElement(
    ThemeProvider,
    {theme: lightTheme},
    createElement(
      CodeBlock,
      {language: 'tsx', filename: 'example.tsx'},
      'const element = <Button />;'
    )
  )
);
assert.match(html, /example\.tsx/);
assert.match(html, /Copy snippet/);
assert.match(html, /--prism-base/);
assert.match(html, /const element = &lt;Button \/&gt;;/);
console.log('Packed CodeBlock, scoped styles, and dynamic TSX dependencies passed.');
`,
  ],
  {cwd: dirname(resolve(manifest)), stdio: 'inherit'}
);
if (result.error) {
  throw result.error;
}
process.exitCode = result.status ?? 1;
