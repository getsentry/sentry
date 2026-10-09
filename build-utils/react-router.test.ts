import assert from 'node:assert/strict';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'node:test';

import type {createMemoryRouter} from 'react-router';
import rspack, {type Stats} from '@rspack/core';

import {getReactRouterConfig} from './react-router.ts';

const root = path.resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);

const entry = `
import {createMemoryRouter, useLocation} from 'react-router';
import {RouterProvider} from 'react-router/dom';
import {useLocation as domUseLocation} from 'react-router-dom';
import {NuqsAdapter} from 'nuqs/adapters/react-router/v6';
import {wrapCreateBrowserRouter, reactRouterBrowserTracingIntegration} from '@sentry/react';
export {RouterProvider, NuqsAdapter, wrapCreateBrowserRouter, reactRouterBrowserTracingIntegration};
export const sharedContext = useLocation === domUseLocation;
export const router = createMemoryRouter([
  {path: '/projects/:projectId', children: [{path: 'issues/:issueId'}]},
], {initialEntries: ['/projects/123/issues/456']});
`;

const cases: Array<[string, NodeJS.ProcessEnv, '8.4.0' | '6.30.6']> = [
  ['local development', {NODE_ENV: 'development'}, '8.4.0'],
  ['production', {NODE_ENV: 'production'}, '6.30.6'],
  [
    'development deploy preview',
    {NODE_ENV: 'development', NOW_GITHUB_DEPLOYMENT: '1'},
    '6.30.6',
  ],
  [
    'production deploy preview',
    {NODE_ENV: 'production', NOW_GITHUB_DEPLOYMENT: '1'},
    '6.30.6',
  ],
  ['CI', {NODE_ENV: 'development', CI: '1'}, '6.30.6'],
  ['test mode', {NODE_ENV: 'test'}, '6.30.6'],
  ['test suite', {NODE_ENV: 'development', TEST_SUITE: '1'}, '6.30.6'],
  ['acceptance tests', {NODE_ENV: 'development', IS_ACCEPTANCE_TEST: '1'}, '6.30.6'],
];

for (const [name, env, version] of cases) {
  test(`${name} compiles one React Router ${version} runtime`, async t => {
    const input = mkdtempSync(path.join(root, 'tests/js/.router-build-'));
    const output = mkdtempSync(path.join(tmpdir(), 'sentry-router-build-'));
    t.after(() => {
      rmSync(input, {recursive: true, force: true});
      rmSync(output, {recursive: true, force: true});
    });
    writeFileSync(path.join(input, 'entry.js'), entry);
    const routerConfig = getReactRouterConfig(env);
    const compiler = rspack({
      context: root,
      mode: env.NODE_ENV === 'production' ? 'production' : 'development',
      target: 'node',
      entry: path.join(input, 'entry.js'),
      output: {path: output, filename: 'router.cjs', library: {type: 'commonjs2'}},
      resolve: {alias: routerConfig.alias},
      module: {
        rules: [
          ...routerConfig.rules,
          {
            test: /\.ts$/,
            loader: 'builtin:swc-loader',
            options: {jsc: {parser: {syntax: 'typescript'}}},
          },
        ],
      },
      optimization: {minimize: false, concatenateModules: false},
      devtool: false,
    });
    const stats = await new Promise<Stats>((resolve, reject) => {
      compiler.run((error, result) => {
        compiler.close(closeError => {
          if (error || closeError) {
            reject(error ?? closeError);
          } else if (!result) {
            reject(new Error('Rspack returned no compilation result'));
          } else {
            resolve(result);
          }
        });
      });
    });
    assert.equal(stats.hasErrors(), false, stats.toString({all: false, errors: true}));
    const modules =
      stats.toJson({all: false, modules: true, orphanModules: true}).modules ?? [];
    const moduleNames = modules.map(module => module.name ?? '').join('\n');
    assert.match(
      moduleNames,
      new RegExp(`react-router@${version.replaceAll('.', '\\.')}`)
    );
    assert.doesNotMatch(
      moduleNames,
      new RegExp(`/.pnpm/react-router@${version === '8.4.0' ? '6\\.' : '8\\.'}`)
    );
    assert.match(
      moduleNames,
      version === '8.4.0'
        ? /adapters\/react-router\/v8\.js/
        : /adapters\/react-router\/v6\.js/
    );

    const {
      router,
      sharedContext,
      RouterProvider,
      NuqsAdapter,
      wrapCreateBrowserRouter,
      reactRouterBrowserTracingIntegration,
    }: {
      router: ReturnType<typeof createMemoryRouter>;
      sharedContext: boolean;
      RouterProvider: unknown;
      NuqsAdapter: unknown;
      wrapCreateBrowserRouter: unknown;
      reactRouterBrowserTracingIntegration: unknown;
    } = require(path.join(output, 'router.cjs'));
    t.after(() => router.dispose());
    assert.equal(sharedContext, true);
    assert.equal(typeof RouterProvider, 'function');
    assert.equal(typeof NuqsAdapter, 'function');
    assert.equal(typeof wrapCreateBrowserRouter, 'function');
    assert.equal(typeof reactRouterBrowserTracingIntegration, 'function');
    assert.deepEqual(router.state.matches.at(-1)?.params, {
      projectId: '123',
      issueId: '456',
    });
    await router.navigate('/projects/789/issues/321?sort=desc');
    assert.equal(router.state.location.search, '?sort=desc');
    assert.deepEqual(router.state.matches.at(-1)?.params, {
      projectId: '789',
      issueId: '321',
    });
    await router.navigate(-1);
    assert.equal(router.state.location.pathname, '/projects/123/issues/456');
  });
}
