import {execFileSync} from 'node:child_process';
import {mkdtemp, mkdir, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const temporary = await mkdtemp(join(root, '.verify-'));
const consumer = join(temporary, 'consumer');
const installed = join(consumer, 'node_modules', '@sentry', 'scraps');
const tarball = join(temporary, 'scraps.tgz');

try {
  await rm(join(root, 'dist'), {recursive: true, force: true});
  await mkdir(installed, {recursive: true});
  execFileSync('pnpm', ['pack', '--out', tarball], {cwd: root, stdio: 'inherit'});
  execFileSync('tar', ['-xzf', tarball, '-C', installed, '--strip-components=1']);

  for (const file of await readdir(installed)) {
    if (!['dist', 'package.json', 'README.md', 'LICENSE.md'].includes(file)) {
      throw new Error(`Unexpected packed file: ${file}`);
    }
  }
  const dependencies = {...packageJson.dependencies, ...packageJson.peerDependencies};
  for (const file of await readdir(join(installed, 'dist'), {recursive: true})) {
    if (!/\.(js|d\.ts)$/.test(file)) {
      continue;
    }
    const contents = await readFile(join(installed, 'dist', file), 'utf8');
    for (const [, specifier] of contents.matchAll(
      /(?:from\s*|import\s*\(\s*|import\s*)['"]([^'"]+)['"]/g
    )) {
      if (specifier.startsWith('.')) {
        continue;
      }
      const name = specifier.startsWith('@')
        ? specifier.split('/').slice(0, 2).join('/')
        : specifier.split('/')[0];
      if (name !== packageJson.name && !(name in dependencies)) {
        throw new Error(`Undeclared dependency: ${specifier} in ${file}`);
      }
    }
  }

  const config = {
    compilerOptions: {
      target: 'ES2022',
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      jsx: 'react-jsx',
      strict: true,
      noEmit: true,
      types: [],
      skipLibCheck: false,
    },
    files: ['entry.mts'],
  };
  await writeFile(join(consumer, 'tsconfig.json'), JSON.stringify(config));
  for (const subpath of Object.keys(packageJson.exports)) {
    const specifier =
      subpath === '.' ? '@sentry/scraps' : `@sentry/scraps/${subpath.slice(2)}`;
    await writeFile(
      join(consumer, 'entry.mts'),
      `import * as entry from '${specifier}';\nvoid entry;\n`
    );
    execFileSync('tsc', ['--project', 'tsconfig.json'], {
      cwd: consumer,
      stdio: 'inherit',
    });
    const runtime = await import(join(installed, packageJson.exports[subpath].import));
    if (!Object.keys(runtime).length) {
      throw new Error(`Empty runtime entry: ${specifier}`);
    }
    console.log(`Verified ${specifier}`);
  }

  await writeFile(
    join(consumer, 'private.mjs'),
    `import {rejects} from 'node:assert/strict';
for (const subpath of ['layout/stack', 'theme/light', 'tokens/color', 'cssTypes', 'code/inlineCode', 'hotkey/kbd']) {
  await rejects(import('@sentry/scraps/' + subpath), {code: 'ERR_PACKAGE_PATH_NOT_EXPORTED'});
}
`
  );
  execFileSync(process.execPath, [join(consumer, 'private.mjs')], {stdio: 'inherit'});

  const {createElement} = await import('react');
  const {renderToStaticMarkup} = await import('react-dom/server');
  const {ThemeProvider} = await import('@emotion/react');
  const {
    Container,
    Flex,
    Grid,
    Stack,
    Surface,
    Text,
    Heading,
    Separator,
    Quote,
    InlineCode,
    Kbd,
    IndeterminateLoader,
    lightTheme,
    darkTheme,
  } = await import(join(installed, 'dist/index.js'));
  const {Stack: stackSubpath} = await import(join(installed, 'dist/layout/index.js'));
  if (Stack !== stackSubpath) {
    throw new Error('Public subpaths created separate component instances');
  }
  for (const theme of [lightTheme, darkTheme]) {
    const html = renderToStaticMarkup(
      createElement(
        ThemeProvider,
        {theme},
        createElement(
          Stack,
          null,
          createElement(Container, null, 'Container'),
          createElement(Flex, null, 'Flex'),
          createElement(Grid, null, 'Grid'),
          createElement(Surface, null, 'Surface'),
          createElement(Text, null, 'Text'),
          createElement(Heading, {as: 'h2'}, 'Heading'),
          createElement(Separator, {orientation: 'horizontal'}),
          createElement(Quote, null, 'Quote'),
          createElement(InlineCode, null, 'InlineCode'),
          createElement(Kbd, null, 'Kbd'),
          createElement(IndeterminateLoader)
        )
      )
    );
    for (const label of [
      'Container',
      'Flex',
      'Grid',
      'Surface',
      'Text',
      'Heading',
      'Quote',
      'InlineCode',
      'Kbd',
    ]) {
      if (!html.includes(label)) {
        throw new Error(`Server render failed for ${label}`);
      }
    }
  }
  console.log('Verified packed server rendering in both themes.');
} finally {
  await rm(temporary, {recursive: true, force: true});
}
