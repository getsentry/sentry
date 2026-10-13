import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import * as ts from 'typescript';

const root = path.resolve(import.meta.dirname, '..');
const configPath = path.join(root, 'tsconfig.json');

// Once V6 support is removed, use V8 types in tsconfig.json and delete this generator.
// Remove the generated config and its .gitignore entry too.
function getV8ConfigPath() {
  const config = ts.parseJsonSourceFileConfigFileContent(
    ts.parseJsonText(configPath, fs.readFileSync(configPath, 'utf8')),
    ts.sys,
    root,
    {},
    configPath
  );
  if (config.errors.length) {
    throw new Error('Could not read tsconfig.json');
  }
  const resolveTypes = (specifier: string) => {
    const resolved = ts.resolveModuleName(
      specifier,
      configPath,
      config.options,
      ts.sys
    ).resolvedModule;
    if (!resolved) {
      throw new Error(`Could not resolve types for ${specifier}`);
    }
    return [resolved.resolvedFileName];
  };
  const v8ConfigPath = path.join(root, 'tsconfig.router-v8.generated.json');
  fs.writeFileSync(
    v8ConfigPath,
    JSON.stringify({
      ...config.raw,
      compilerOptions: {
        ...config.raw.compilerOptions,
        paths: {
          ...config.options.paths,
          'react-router': resolveTypes('react-router-v8'),
          'react-router/dom': resolveTypes('react-router-v8/dom'),
          'nuqs/adapters/react-router/v6': resolveTypes('nuqs/adapters/react-router/v8'),
        },
      },
    })
  );
  return v8ConfigPath;
}

// After migration, restore a single typecheck build in package.json and delete this runner.
// Keep the service worker project and referenced package builds.
const selectedVersion = process.env.SENTRY_REACT_ROUTER_VERSION;
if (selectedVersion !== undefined && !['6', '8'].includes(selectedVersion)) {
  throw new Error(`Unsupported SENTRY_REACT_ROUTER_VERSION: ${selectedVersion}`);
}
const versions = selectedVersion === undefined ? ['6', '8'] : [selectedVersion];
for (const version of versions) {
  console.log(`Typechecking with React Router v${version}`);
  const result = spawnSync(
    'tsc',
    [
      '--build',
      version === '8' ? getV8ConfigPath() : configPath,
      path.join(root, 'static/app/serviceWorker/worker/tsconfig.json'),
      '--builders',
      '2',
    ],
    {stdio: 'inherit'}
  );
  if (result.error) {
    throw result.error;
  }
  process.exitCode ||= result.status ?? 1;
}
