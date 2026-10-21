import {execFileSync} from 'node:child_process';
import {mkdtemp, mkdir, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {pluginReact} from '@rsbuild/plugin-react';
import {createRslib} from '@rslib/core';

const root = fileURLToPath(new URL('../', import.meta.url));
const packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const temporary = await mkdtemp(join(root, '.verify-'));
const consumer = join(temporary, 'consumer');
const installed = join(consumer, 'node_modules', '@sentry', 'scraps');
const tarball = join(temporary, 'scraps.tgz');

try {
  await rm(join(root, 'dist'), {recursive: true, force: true});
  await mkdir(installed, {recursive: true});
  await writeFile(
    join(consumer, 'package.json'),
    JSON.stringify({name: 'scraps-verify-consumer', private: true, type: 'module'})
  );
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

  // Icons currently exports workspace source. Compile a temporary dependency so
  // Node can verify the packed Scraps JavaScript without a TSX loader.
  const iconsRoot = fileURLToPath(new URL('../../icons/', import.meta.url));
  const installedIcons = join(consumer, 'node_modules', '@sentry', 'icons');
  const iconsPackage = JSON.parse(
    await readFile(join(iconsRoot, 'package.json'), 'utf8')
  );
  const iconsTsconfig = join(temporary, 'icons.tsconfig.json');
  await writeFile(
    iconsTsconfig,
    JSON.stringify({
      extends: join(iconsRoot, 'tsconfig.json'),
      compilerOptions: {
        rootDir: join(iconsRoot, 'src'),
        outDir: join(installedIcons, 'dist'),
        declarationDir: join(installedIcons, 'dist'),
        composite: false,
        tsBuildInfoFile: join(temporary, 'icons.tsbuildinfo'),
      },
      include: [join(iconsRoot, 'src')],
      exclude: [join(iconsRoot, 'src/**/*.spec.tsx')],
    })
  );
  const iconsBuild = await createRslib({
    cwd: iconsRoot,
    config: {
      lib: [{format: 'esm', bundle: false, dts: {build: true}, syntax: 'es2022'}],
      source: {
        tsconfigPath: iconsTsconfig,
        entry: {index: ['./src/**', '!src/**/*.spec.tsx']},
      },
      output: {
        target: 'node',
        distPath: {root: join(installedIcons, 'dist')},
        cleanDistPath: false,
      },
      plugins: [pluginReact()],
    },
  });
  await iconsBuild.build();
  await writeFile(
    join(installedIcons, 'package.json'),
    JSON.stringify({
      ...iconsPackage,
      exports: Object.fromEntries(
        Object.entries(iconsPackage.exports).map(([subpath, source]) => [
          subpath,
          source.replace('./src/', './dist/').replace(/\.tsx?$/, '.js'),
        ])
      ),
    })
  );

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
    const specifier = `@sentry/scraps/${subpath.slice(2)}`;
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
await rejects(import('@sentry/scraps'), {code: 'ERR_PACKAGE_PATH_NOT_EXPORTED'});
for (const subpath of ['layout/stack', 'theme/light', 'tokens/color', 'cssTypes']) {
  await rejects(import('@sentry/scraps/' + subpath), {code: 'ERR_PACKAGE_PATH_NOT_EXPORTED'});
}
`
  );
  execFileSync(process.execPath, [join(consumer, 'private.mjs')], {stdio: 'inherit'});

  const {createElement} = await import('react');
  const {renderToStaticMarkup} = await import('react-dom/server');
  const {ThemeProvider} = await import('@emotion/react');
  const {Container, Flex, Grid, Stack, Surface} = await import(
    join(installed, 'dist/layout/index.js')
  );
  const {Text, Heading, Prose} = await import(join(installed, 'dist/text/index.js'));
  const {Separator} = await import(join(installed, 'dist/separator/index.js'));
  const {Quote} = await import(join(installed, 'dist/quote/index.js'));
  const {InlineCode} = await import(join(installed, 'dist/code/inlineCode.js'));
  const {Kbd} = await import(join(installed, 'dist/hotkey/kbd.js'));
  const {IndeterminateLoader} = await import(join(installed, 'dist/loader/index.js'));
  const {Switch} = await import(join(installed, 'dist/switch/index.js'));
  const {Link, ExternalLink} = await import(join(installed, 'dist/link/index.js'));
  const {Image} = await import(join(installed, 'dist/image/index.js'));
  const {DescriptionList} = await import(
    join(installed, 'dist/descriptionList/index.js')
  );
  const {default: InteractionStateLayer} = await import(
    join(installed, 'dist/interactionStateLayer/index.js')
  );
  const {Radio} = await import(join(installed, 'dist/radio/index.js'));
  const {StatusIndicator} = await import(
    join(installed, 'dist/statusIndicator/index.js')
  );
  const {Hotkey} = await import(join(installed, 'dist/hotkey/index.js'));
  const {lightTheme, darkTheme} = await import(join(installed, 'dist/theme/index.js'));
  const {Tooltip} = await import(join(installed, 'dist/tooltip/index.js'));
  const {Button, LinkButton, ButtonBar} = await import(
    join(installed, 'dist/button/index.js')
  );
  const {InfoTip, InfoText} = await import(join(installed, 'dist/info/index.js'));
  const {Checkbox} = await import(join(installed, 'dist/checkbox/index.js'));
  const {Chip} = await import(join(installed, 'dist/chip/index.js'));
  const {Disclosure} = await import(join(installed, 'dist/disclosure/index.js'));
  const {SegmentedControl} = await import(
    join(installed, 'dist/segmentedControl/index.js')
  );
  const {Alert} = await import(join(installed, 'dist/alert/index.js'));
  const {Badge, Tag, FeatureBadge} = await import(join(installed, 'dist/badge/index.js'));
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
          createElement(IndeterminateLoader),
          createElement(Switch, {'aria-label': 'Switch'}),
          createElement(Image, {
            src: 'https://example.com/image.png',
            alt: 'Package image',
          }),
          createElement(
            DescriptionList,
            null,
            createElement(DescriptionList.Term, null, 'Term'),
            createElement(DescriptionList.Details, null, 'Details')
          ),
          createElement(Prose, null, createElement('code', null, 'Prose code')),
          createElement(InteractionStateLayer, null, 'State layer'),
          createElement(Radio, {'aria-label': 'Package radio'}),
          createElement(StatusIndicator, {variant: 'success', 'aria-label': 'Online'}),
          createElement(Hotkey, {value: 'shift+k'}),
          createElement(
            ButtonBar,
            null,
            createElement(
              Button,
              {tooltipProps: {title: 'Save changes'}},
              'Save control'
            ),
            createElement(LinkButton, {to: '/settings/'}, 'Settings control')
          ),
          createElement(InfoTip, {title: 'Details'}),
          createElement(InfoText, {title: 'More details'}, 'Info control'),
          createElement(Checkbox, {'aria-label': 'Accept control'}),
          createElement(Chip, {value: 'Chip control'}),
          createElement(
            Disclosure,
            {expanded: true},
            createElement(Disclosure.Title, null, 'Disclosure control'),
            createElement(Disclosure.Content, null, 'Expanded content')
          ),
          createElement(
            SegmentedControl,
            {'aria-label': 'View control', value: 'one', onChange() {}},
            createElement(SegmentedControl.Item, {key: 'one'}, 'First view'),
            createElement(SegmentedControl.Item, {key: 'two'}, 'Second view')
          ),
          createElement(Alert, {variant: 'info'}, 'Alert control'),
          createElement(Badge, {variant: 'success'}, 'Badge control'),
          createElement(Tag, {variant: 'info'}, 'Tag control'),
          createElement(FeatureBadge, {type: 'new'}),
          createElement(
            Link,
            {to: {pathname: '/issues/', query: {query: 'error'}, hash: 'details'}},
            'Package link'
          ),
          createElement(ExternalLink, {href: 'https://example.com'}, 'External link'),
          createElement(Tooltip, {title: 'Help'}, 'Tooltip trigger')
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
      'data-icon="checkmark"',
      'data-icon="close"',
      'Package link',
      'External link',
      'Package image',
      '<dt',
      '<dd',
      'Prose code',
      'State layer',
      'type="radio"',
      'aria-label="Online"',
      'aria-label="⇧"',
      'Tooltip trigger',
      'Save control',
      'Settings control',
      'href="/settings/"',
      'Info control',
      'Accept control',
      'Chip control',
      'Disclosure control',
      'Expanded content',
      'First view',
      'Second view',
      'Alert control',
      'Badge control',
      'Tag control',
    ]) {
      if (!html.includes(label)) {
        throw new Error(`Server render failed for ${label}`);
      }
    }
    if (
      !html.includes('href="/issues/?query=error#details"') ||
      !html.includes('rel="noreferrer noopener"')
    ) {
      throw new Error('Packed links lost their destinations or security attributes');
    }
  }
  console.log('Verified packed server rendering in both themes.');
} finally {
  await rm(temporary, {recursive: true, force: true});
}
