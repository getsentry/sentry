// Run against a consumer with the packed Scraps and Icons tarballs installed:
// node test/packedSelect.mjs /absolute/path/to/consumer/package.json
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
import {createElement} from 'react';
import {renderToString} from 'react-dom/server';
import {ThemeProvider} from '@emotion/react';
import {Select, createFilter} from '@sentry/scraps/select';
import {lightTheme} from '@sentry/scraps/theme';
import {useVirtualRows} from '@sentry/scraps/useVirtualRows';

const options = [{label: 'Apple', value: 'apple'}, {label: 'Cherry', value: 'cherry'}];
const props = {options, value: 'apple'};
assert.equal(typeof useVirtualRows, 'function');
assert.equal(createFilter()(options[0], 'app'), true);
assert.equal(createFilter()(options[0], 'cherry'), false);
for (const selectProps of [
  props,
  {...props, multiple: true, value: ['apple']},
  {...props, isLoading: true},
  {...props, creatable: true},
  {...props, virtualized: true},
]) {
  const html = renderToString(
    createElement(ThemeProvider, {theme: lightTheme}, createElement(Select, selectProps))
  );
  assert.match(html, /Apple/);
}
console.log('Packed Select: native ESM, single/multiple, loading, creatable, virtualization and filtering passed.');
`,
  ],
  {cwd: dirname(resolve(manifest)), stdio: 'inherit'}
);
if (result.error) {
  throw result.error;
}
process.exitCode = result.status ?? 1;
