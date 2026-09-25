import {execFileSync} from 'node:child_process';
import {mkdtemp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const temporary = await mkdtemp(join(root, '.verify-'));
const consumer = join(temporary, 'consumer');
const installed = join(consumer, 'node_modules', '@sentry', 'scraps');

try {
  execFileSync('node', ['scripts/build.mjs'], {cwd: root, stdio: 'inherit'});
  await mkdir(installed, {recursive: true});
  const pack = JSON.parse(
    execFileSync('npm', ['pack', '--json', '--pack-destination', temporary], {
      cwd: root,
      encoding: 'utf8',
      env: {...process.env, npm_config_cache: join(temporary, 'npm-cache')},
    })
  );
  if (pack[0].files.some(({path}) => path.startsWith('scripts/'))) {
    throw new Error('Local scripts were included in the package tarball');
  }
  execFileSync('tar', [
    '-xzf',
    join(temporary, pack[0].filename),
    '-C',
    installed,
    '--strip-components=1',
  ]);

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
    execFileSync(
      resolve(root, '../../node_modules/.bin/tsc'),
      ['--project', 'tsconfig.json'],
      {
        cwd: consumer,
        stdio: 'inherit',
      }
    );
    const runtime = await import(join(installed, packageJson.exports[subpath].import));
    if (!Object.keys(runtime).length && subpath !== './cssTypes') {
      throw new Error(`Empty runtime entry: ${specifier}`);
    }
    console.log(`Verified ${specifier}`);
  }

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
  const {Stack: stackSubpath} = await import(join(installed, 'dist/layout/stack.js'));
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
