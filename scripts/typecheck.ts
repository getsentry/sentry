import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import * as ts from 'typescript';

const root = path.resolve(import.meta.dirname, '..');
const configPath = path.join(root, 'tsconfig.json');

function getV8ConfigPath() {
  const config = ts.getParsedCommandLineOfConfigFile(
    configPath,
    {},
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: diagnostic => {
        throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
      },
    }
  );
  if (!config || config.errors.length) {
    throw new Error('Could not read tsconfig.json');
  }
  const paths = Object.fromEntries(
    Object.entries(config.options.paths ?? {}).map(([alias, targets]) => [
      alias,
      targets.map(target => path.resolve(root, target)),
    ])
  );
  const directory = path.join(root, '.artifacts/typecheck-router-v8');
  const v8ConfigPath = path.join(directory, 'tsconfig.json');
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
  fs.mkdirSync(directory, {recursive: true});
  fs.writeFileSync(
    v8ConfigPath,
    JSON.stringify({
      extends: configPath,
      compilerOptions: {
        paths: {
          ...paths,
          'react-router': resolveTypes('react-router-v8'),
          'react-router/dom': resolveTypes('react-router-v8/dom'),
          'nuqs/adapters/react-router/v6': resolveTypes('nuqs/adapters/react-router/v7'),
        },
      },
      references: config.projectReferences?.map(reference => ({path: reference.path})),
    })
  );
  return v8ConfigPath;
}

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
