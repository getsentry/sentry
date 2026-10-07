/* eslint-disable boundaries/dependencies -- Unit tests exercise the collector script exports. */
import assert from 'node:assert/strict';
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'node:test';

import ts from 'typescript';

import {
  aggregate,
  aggregateRules,
  analyzeSources,
  codeowners,
  eligible,
  measurements,
  parseLintReport,
  publish,
} from './collectDesignSystemMetrics.ts';

test('CODEOWNERS uses last match, all owners, ownerless clearing and directory boundaries', () => {
  const ownership = codeowners(`
* @default
/static/app/ @frontend @design
/static/app/**/special?.tsx @special
/static/app/cleared/
*.js @javascript
/static/app/literal.+^$|.tsx @literal
`);
  assert.deepEqual(ownership.forFile('static/app/page.tsx'), ['@frontend', '@design']);
  assert.deepEqual(ownership.forFile('static/app/special1.tsx'), ['@special']);
  assert.deepEqual(ownership.forFile('static/app/deep/special2.tsx'), ['@special']);
  assert.deepEqual(ownership.forFile('static/app/cleared/page.tsx'), []);
  assert.deepEqual(ownership.forFile('static/application/page.tsx'), ['@default']);
  assert.deepEqual(ownership.forFile('static/app/file.js'), ['@javascript']);
  assert.deepEqual(ownership.forFile('static/app/literal.+^$|.tsx'), ['@literal']);
  assert.deepEqual(ownership.forFile('static/app/literalX.tsx'), [
    '@frontend',
    '@design',
  ]);
  assert.throws(() => codeowners('![abc] @owner'), /Unsupported/);
  assert.throws(
    () => codeowners(String.raw`/static/app/foo\bar.tsx @owner`),
    /Unsupported/
  );
});

test('source inventory counts actual bindings, canonical components, Emotion, and overlapping owners', t => {
  const root = mkdtempSync(path.join(tmpdir(), 'design-system-metrics-'));
  t.after(() => rmSync(root, {recursive: true, force: true}));
  const sources = {
    'static/app/components/core/badge.tsx':
      "import styled from '@emotion/styled'; export const Badge = styled.div`color:red`;",
    'static/app/components/core/layout/stack.tsx':
      'export const Stack = Object.assign(() => <div/>, {Separator: () => <hr/>});',
    'static/app/components/core/layout/index.tsx': "export {Stack} from './stack';",
    'static/app/components/core/button.tsx':
      'export default function Button() { return <button/> }',
    'static/app/components/table.tsx':
      'export default function Table() { return <table/> }',
    'static/app/page.tsx': `
import {Stack as Alias} from '@sentry/scraps/layout';
import * as Layout from '@sentry/scraps/layout';
import Button from '@sentry/scraps/button';
import {Stack as Legacy} from 'sentry/components/core/layout';
import Table from 'sentry/components/table';
import styled from '@emotion/styled';
import {css as styles} from '@emotion/react';
import * as emotion from '@emotion/react';
const One = styled('div')({});
const Two = styled.div\`color:red\`;
const Three = styled(Button)\`color:red\`;
const a = styles({});
const b = emotion.css\`color:red\`;
function shadow(Alias, styles, styled) { styles({}); styled.div({}); return <Alias/>; }
export const Page = () => <><Alias/><Alias.Separator/><Layout.Stack/><Button/><Legacy/><Table/><div css={a}/></>;
`,
  };
  for (const [file, contents] of Object.entries(sources)) {
    mkdirSync(path.dirname(path.join(root, file)), {recursive: true});
    writeFileSync(path.join(root, file), contents);
  }
  const ownership = codeowners(
    '/static/app/ @one @two\n/static/app/components/core/ @design'
  );
  const {files, catalog} = analyzeSources(
    root,
    Object.keys(sources),
    {
      jsx: ts.JsxEmit.Preserve,
      module: ts.ModuleKind.Preserve,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      paths: {
        '@sentry/scraps/*': [path.join(root, 'static/app/components/core/*')],
        'sentry/*': [path.join(root, 'static/app/*')],
      },
    },
    ownership
  );
  const page = files.find(file => file.path.endsWith('/page.tsx'))!;
  assert.equal(page.jsxElements, 8);
  assert.deepEqual(page.emotion, {references: 5, styled: 3, css: 2, cssProps: 1});
  const stack = page.components.find(
    item => item.component.endsWith('stack.tsx#Stack') && item.source === 'scraps'
  )!;
  assert.equal(stack.uses, 2);
  assert.equal(
    page.components.find(item => item.source === 'core')!.component,
    stack.component
  );
  assert.equal(
    page.components.find(item => item.component.endsWith('#Stack.Separator'))!.uses,
    1
  );
  assert.equal(
    page.components.find(item => item.component.endsWith('button.tsx#default'))!.uses,
    1
  );
  assert.equal(page.components.find(item => item.source === 'shared')!.uses, 1);
  writeFileSync(
    path.join(root, 'static/app/page.tsx'),
    'export const Page = () => <div/>;'
  );
  const withoutUses = analyzeSources(
    root,
    Object.keys(sources),
    {jsx: ts.JsxEmit.Preserve},
    ownership
  );
  assert(withoutUses.catalog.some(component => component.endsWith('badge.tsx#Badge')));
  assert(
    withoutUses.catalog.some(component => component.endsWith('stack.tsx#Stack.Separator'))
  );
  assert(withoutUses.catalog.includes(stack.component));
  const rules = [{rule: '@sentry/scraps/example', stage: 'incubator' as const}];
  page.violations[rules[0]!.rule] = 2;
  const buckets = aggregate(files, rules, ownership.owners);
  const application = buckets.find(
    bucket => bucket.owner === 'all' && bucket.scope === 'application'
  )!;
  assert.equal(application.files, 2);
  assert.equal(application.scrapsFiles, 1);
  assert.deepEqual(application.rules[0], {...rules[0], violations: 2, files: 1});
  assert.equal(
    buckets.find(bucket => bucket.owner === '@one' && bucket.scope === 'application')!
      .rules[0]!.violations,
    2
  );
  const cleared = aggregate(
    files.map(file => ({...file, components: [], violations: {}})),
    rules,
    ownership.owners
  );
  const zeros = [
    ...measurements({
      buckets: cleared,
      catalog,
      ruleBuckets: aggregateRules({rules, findings: []}, ownership),
    }),
  ];
  assert(
    zeros.some(
      metric => metric.name === 'design_system.rule.violations' && metric.value === 0
    )
  );
  assert(
    zeros.some(
      metric =>
        metric.name === 'design_system.component.uses' &&
        'component' in metric.attributes &&
        metric.attributes.component === stack.component &&
        metric.value === 0
    )
  );
});

test('scope and report validation do not turn missing scans into clean measurements', () => {
  for (const file of [
    'static/app/example.spec.tsx',
    'static/app/foo.d.ts',
    'static/app/fixtures/foo.ts',
    'static/app/stories/test.tsx',
    'static/app/foo.generated.ts',
  ]) {
    assert(!eligible(file));
  }
  assert(eligible('static/gsApp/views/example.tsx'));
  assert.throws(() => parseLintReport('{"findings":[]}'), /Invalid lint report/);
  assert.throws(
    () => parseLintReport('{"rules":[],"findings":[{"rule":"unknown"}]}'),
    /Invalid lint finding/
  );
  assert.deepEqual(parseLintReport('{"rules":[],"findings":[]}'), {
    rules: [],
    findings: [],
  });
});

test('publication uses real SDK batches and rejects HTTP errors, drops and flush failures', async () => {
  const Sentry = await import('@sentry/node');
  const bucket = aggregate([], [], [])[0]!;
  const snapshot = {
    schemaVersion: 1 as const,
    collectedAt: '2026-01-01T00:00:00Z',
    commit: 'test',
    hashes: {},
    scope: {roots: [], exclusions: '', ownerTotalsOverlap: true as const},
    rules: [],
    files: [],
    findings: [],
    excludedFindings: 0,
    buckets: [bucket],
    ruleBuckets: [],
    catalog: Array.from({length: 100}, (_, i) => `component${i}`),
  };
  const requests: string[] = [];
  let statusCode: number | undefined = 200;
  const sdk = {
    ...Sentry,
    makeNodeTransport: (options: Parameters<typeof Sentry.makeNodeTransport>[0]) =>
      Sentry.createTransport(options, ({body}) => {
        requests.push(String(body));
        return Promise.resolve({
          statusCode,
          headers: {'x-sentry-rate-limits': null, 'retry-after': null},
        });
      }),
  };
  await assert.rejects(
    publish(snapshot, sdk, undefined),
    /requires DESIGN_SYSTEM_METRICS_DSN/
  );
  assert.equal(requests.length, 0);
  assert.equal(await publish(snapshot, sdk, 'https://key@example.com/1'), 608);
  assert.equal(requests.length, 3);
  assert(!requests[0]!.includes('design_system.collected_at'));
  assert(!requests[1]!.includes('design_system.collected_at'));
  assert(requests[2]!.includes('design_system.collected_at'));
  await Sentry.close();
  for (statusCode of [429, 500, undefined]) {
    requests.length = 0;
    await assert.rejects(
      publish(snapshot, sdk, 'https://key@example.com/1'),
      /Sentry rejected metrics/
    );
    assert.equal(requests.length, 1);
    assert(!requests[0]!.includes('design_system.collected_at'));
    await Sentry.close();
  }
  await assert.rejects(
    publish(
      snapshot,
      {...sdk, flush: () => Promise.resolve(false)},
      'https://key@example.com/1'
    ),
    /flush failed/
  );
  await Sentry.close();
});

test('repository rule totals retain test-only owners at zero after the last finding is fixed', () => {
  const ownership = codeowners(`/static/app/ @app
/static/app/example.spec.tsx @tests @design`);
  const rules = [{rule: '@sentry/scraps/test-only', stage: 'enforced' as const}];
  const findings = [1, 2].map(line => ({
    file: 'static/app/example.spec.tsx',
    rule: rules[0]!.rule,
    line,
    column: 1,
    message: 'test',
  }));
  const before = aggregateRules({rules, findings}, ownership);
  assert.deepEqual(before.find(bucket => bucket.owner === 'all')!.rules[0], {
    ...rules[0],
    violations: 2,
    files: 1,
  });
  assert.equal(before.find(bucket => bucket.owner === '@tests')!.rules[0]!.violations, 2);
  const after = aggregateRules({rules, findings: []}, ownership);
  assert.deepEqual(after.find(bucket => bucket.owner === '@tests')!.rules[0], {
    ...rules[0],
    violations: 0,
    files: 0,
  });
});
