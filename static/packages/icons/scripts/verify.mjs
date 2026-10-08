import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

import {build} from 'esbuild';
import ts from 'typescript';

const root = new URL('../', import.meta.url);
const require = createRequire(new URL('package.json', root));
const packageJson = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
const dependencies = {...packageJson.dependencies, ...packageJson.peerDependencies};

assert.equal(packageJson.private, true);
assert.equal(packageJson.exports['.'], undefined);
assert.equal(packageJson.scripts.build, undefined);
assert.equal(packageJson.scripts.prepack, undefined);

const entries = [];
for (const [subpath, target] of Object.entries(packageJson.exports)) {
  assert.ok(!subpath.includes('*'), `Wildcard export: ${subpath}`);
  assert.equal(
    require.resolve(`@sentry/icons/${subpath.slice(2)}`),
    fileURLToPath(new URL(target, root))
  );
  entries.push(
    `import * as entry${entries.length} from '@sentry/icons/${subpath.slice(2)}';\nconsole.log(entry${entries.length});`
  );
}

for (const subpath of ['', '/package.json', '/src/iconAdd', '/useIconTheme']) {
  assert.throws(() => require.resolve(`@sentry/icons${subpath}`), {
    code: 'ERR_PACKAGE_PATH_NOT_EXPORTED',
  });
}

for (const file of await readdir(new URL('src/', root))) {
  if (!/\.tsx?$/.test(file) || file.endsWith('.spec.tsx')) {
    continue;
  }
  const contents = await readFile(new URL(`src/${file}`, root), 'utf8');
  const source = ts.createSourceFile(
    file,
    contents,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const check = node => {
    const specifier =
      ts.isImportDeclaration(node) || ts.isExportDeclaration(node)
        ? node.moduleSpecifier
        : ts.isCallExpression(node) &&
            (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
              node.expression.getText(source) === 'require')
          ? node.arguments[0]
          : undefined;
    if (specifier && ts.isStringLiteral(specifier)) {
      const name = specifier.text;
      if (!name.startsWith('.')) {
        const dependency = name.startsWith('@')
          ? name.split('/').slice(0, 2).join('/')
          : name.split('/')[0];
        assert.ok(
          dependency in dependencies,
          `Undeclared dependency: ${name} in ${file}`
        );
      }
    }
    ts.forEachChild(node, check);
  };
  check(source);
}

// Bundle in memory through the actual exports. No app aliases or generated files.
await build({
  stdin: {contents: entries.join('\n'), resolveDir: fileURLToPath(root), loader: 'tsx'},
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'browser',
  jsx: 'automatic',
  external: Object.keys(dependencies),
});

console.log(`Verified ${entries.length} public entry points and isolated dependencies.`);
