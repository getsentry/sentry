// Run after building @sentry/icons and packing @sentry/scraps:
// node static/packages/scraps/test/packedDrawerConsumer.mjs path/to/sentry-scraps.tgz path/to/sentry-icons.tgz
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import ts from 'typescript';

const packageRoot = fileURLToPath(new URL('..', import.meta.url));
const tarballArg = process.argv[2];
const iconsArg = process.argv[3];
assert(tarballArg && iconsArg, 'Pass the packed scraps and icons tarball paths.');
const tarball = path.resolve(tarballArg);
const iconsTarball = path.resolve(iconsArg);
const consumer = await mkdtemp(path.join(tmpdir(), 'scraps-drawer-consumer-'));

/** @param {string} directory */
async function checkImports(directory) {
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await checkImports(filename);
    } else if (/\.(js|ts)$/.test(entry.name)) {
      assert.doesNotMatch(await readFile(filename, 'utf8'), /['"]sentry\//, filename);
    }
  }
}

try {
  const modules = path.join(consumer, 'node_modules');
  const packed = path.join(modules, '@sentry/scraps');
  await mkdir(packed, {recursive: true});
  execFileSync('tar', ['-xzf', tarball, '-C', packed, '--strip-components=1']);
  const manifest = JSON.parse(await readFile(path.join(packed, 'package.json'), 'utf8'));
  // Reuse installed third-party dependencies. Scraps itself comes only from the tarball.
  for (const name of Object.keys({
    ...manifest.dependencies,
    ...manifest.peerDependencies,
    ...manifest.devDependencies,
  })) {
    const target = path.join(modules, name);
    await mkdir(path.dirname(target), {recursive: true});
    await symlink(path.join(packageRoot, 'node_modules', name), target);
  }
  const packedIcons = path.join(modules, '@sentry/icons');
  await rm(packedIcons);
  await mkdir(packedIcons);
  execFileSync('tar', ['-xzf', iconsTarball, '-C', packedIcons, '--strip-components=1']);
  await writeFile(path.join(consumer, 'package.json'), '{"type":"module"}');
  const source = path.join(consumer, 'consumer.tsx');
  await writeFile(
    source,
    `
import {DrawerBody, DrawerHeader, DrawerPanel, type DrawerPanelProps} from '@sentry/scraps/drawer';
import {SlideOverPanel, type SlideOverPanelProps} from '@sentry/scraps/slideOverPanel';
const drawer: DrawerPanelProps = {ariaLabel: 'Details', mode: 'blocking', children: <DrawerBody>Body</DrawerBody>};
const panel: SlideOverPanelProps = {contentTop: '80px', children: 'Panel'};
export const content = <><DrawerPanel {...drawer}><DrawerHeader height="64px" /></DrawerPanel><SlideOverPanel {...panel} /></>;
`
  );
  const program = ts.createProgram([source], {
    strict: true,
    noEmit: true,
    skipLibCheck: false,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX,
    types: [],
  });
  const diagnostics = ts.getPreEmitDiagnostics(program);
  assert.equal(
    diagnostics.length,
    0,
    ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCurrentDirectory: () => consumer,
      getCanonicalFileName: name => name,
      getNewLine: () => '\n',
    })
  );

  await checkImports(path.join(packed, 'dist'));
  await writeFile(
    path.join(consumer, 'runtime.mjs'),
    `
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', {url: 'http://localhost', pretendToBeVisual: true});
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLButtonElement', 'Element', 'SVGElement', 'Node', 'NodeFilter', 'MutationObserver', 'Event', 'KeyboardEvent', 'MouseEvent', 'PointerEvent']) {
  Object.defineProperty(globalThis, name, {configurable: true, value: dom.window[name]});
}
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// jsdom has no layout observer; browsers provide this API.
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
const {createElement: h} = await import('react');
const {ThemeProvider} = await import('@emotion/react');
const {render, screen, cleanup} = await import('@testing-library/react');
const {default: userEvent} = await import('@testing-library/user-event');
const {DrawerPanel, DrawerHeader, DrawerBody} = await import('@sentry/scraps/drawer');
const {SlideOverPanel} = await import('@sentry/scraps/slideOverPanel');
const {lightTheme} = await import('@sentry/scraps/theme');
let closed = false;
let width;
render(h(ThemeProvider, {theme: lightTheme},
  h(DrawerPanel, {mode: 'blocking', ariaLabel: 'Details', onClose: () => {closed = true}, onWidthChange: value => {width = value}},
    h(DrawerHeader, {height: '64px'}, 'Details'),
    h(DrawerBody, null, 'Packed drawer'))));
await screen.findByText('Packed drawer');
const separator = screen.getByRole('separator', {name: 'Resize drawer'});
separator.focus();
await userEvent.keyboard('{ArrowLeft}');
assert(width > 50);
assert.equal(document.activeElement, separator);
await userEvent.click(screen.getByRole('button', {name: 'Close Drawer'}));
assert(closed);
cleanup();
render(h(ThemeProvider, {theme: lightTheme},
  h(SlideOverPanel, {mode: 'passive', position: 'right', contentTop: '80px'}, 'Packed panel')));
await screen.findByText('Packed panel');
assert.equal(getComputedStyle(screen.getByRole('complementary')).top, '80px');
cleanup();
dom.window.close();
console.log('Packed drawer consumer: declarations, runtime exports, close, keyboard resize, focus, and offset passed.');
`
  );
  execFileSync(process.execPath, [path.join(consumer, 'runtime.mjs')], {
    stdio: 'inherit',
  });
} finally {
  await rm(consumer, {recursive: true, force: true});
}
