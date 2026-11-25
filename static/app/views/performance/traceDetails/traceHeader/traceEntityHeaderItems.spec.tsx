import {EventFixture} from 'sentry-fixture/event';
import {OrganizationFixture} from 'sentry-fixture/organization';

import type {
  TraceItemDetailsResponse,
  TraceItemResponseAttribute,
} from 'sentry/views/explore/hooks/useTraceItemDetails';
import type {OurLogsResponseItem} from 'sentry/views/explore/logs/types';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';
import type {TraceTree} from 'sentry/views/performance/traceDetails/traceModels/traceTree';

import {
  getReplayId,
  getTraceMetadataItems,
  getTraceProperties,
  getTraceTitle,
} from './traceEntityHeaderItems';

function makeTraceItemDetailsResponse(
  attributes: TraceItemResponseAttribute[]
): TraceItemDetailsResponse {
  return {itemId: 'span-1', timestamp: '2024-01-01T00:00:00Z', meta: {}, attributes};
}

describe('getTraceTitle', () => {
  it('falls back to Trace without a representative event', () => {
    expect(getTraceTitle(null)).toEqual({title: 'Trace'});
  });

  it('titles a log-only trace with the log message, without escape codes', () => {
    const log = {
      [OurLogKnownFieldKey.MESSAGE]: '\x1B[31mfailed\x1B[0m to connect',
      [OurLogKnownFieldKey.SEVERITY]: 'info',
    } as OurLogsResponseItem;

    expect(getTraceTitle({event: log, dataset: null})).toEqual({
      title: 'failed to connect',
      operation: undefined,
    });
  });

  it('prefers the subtitle and returns the title it replaces as the operation', () => {
    const representativeEvent = {
      event: {
        traceHeaderTitle: {title: '\x1B[31mhttp.server\x1B[0m', subtitle: 'GET /users'},
      },
      dataset: null,
    } as unknown as TraceTree.RepresentativeTraceEvent;

    expect(getTraceTitle(representativeEvent)).toEqual({
      title: 'GET /users',
      operation: 'http.server',
    });
  });

  it('falls back to the title when there is no subtitle', () => {
    const representativeEvent = {
      event: {traceHeaderTitle: {title: 'http.server'}},
      dataset: null,
    } as unknown as TraceTree.RepresentativeTraceEvent;

    expect(getTraceTitle(representativeEvent)).toEqual({title: 'http.server'});
  });
});

describe('getReplayId', () => {
  it('reads the replay id from EAP attributes', () => {
    expect(
      getReplayId(
        makeTraceItemDetailsResponse([{name: 'replay_id', type: 'str', value: 'abc123'}])
      )
    ).toBe('abc123');
  });

  it('reads the replay id from a legacy event context', () => {
    expect(
      getReplayId(EventFixture({contexts: {replay: {replay_id: 'abc123'}}}) as any)
    ).toBe('abc123');
  });

  it('returns undefined without a replay', () => {
    expect(getReplayId(makeTraceItemDetailsResponse([]))).toBeUndefined();
    expect(getReplayId(undefined)).toBeUndefined();
  });
});

describe('getTraceProperties', () => {
  it('reads user, os, browser, and runtime from EAP span attributes', () => {
    expect(
      getTraceProperties(
        makeTraceItemDetailsResponse([
          {name: 'user.email', type: 'str', value: 'user@example.com'},
          {name: 'os.name', type: 'str', value: 'Windows'},
          {name: 'os.version', type: 'str', value: '10'},
          {name: 'browser.name', type: 'str', value: 'Chrome'},
          {name: 'browser.version', type: 'str', value: '120.0'},
          {name: 'runtime.name', type: 'str', value: 'node'},
          {name: 'runtime.version', type: 'str', value: '18.0.0'},
        ])
      )
    ).toEqual({
      user: {field: 'user.email', value: 'user@example.com'},
      os: {name: 'Windows', version: '10'},
      browser: {name: 'Chrome', version: '120.0'},
      runtime: {name: 'node', version: '18.0.0'},
      release: undefined,
      region: undefined,
      environment: undefined,
    });
  });

  it('reads attribute keys that come back wrapped as tags[name,type]', () => {
    // The trace item details API wraps an attribute whose stored key collides
    // with a known public alias, so these are the keys real span data arrives with.
    expect(
      getTraceProperties(
        makeTraceItemDetailsResponse([
          {name: 'tags[user.email,string]', type: 'str', value: 'user@example.com'},
          {name: 'tags[os.name,string]', type: 'str', value: 'Windows'},
          {name: 'tags[browser.name,string]', type: 'str', value: 'Chrome'},
          {name: 'tags[runtime.name,string]', type: 'str', value: 'node'},
        ])
      )
    ).toMatchObject({
      user: {field: 'user.email', value: 'user@example.com'},
      os: {name: 'Windows'},
      browser: {name: 'Chrome'},
      runtime: {name: 'node'},
    });
  });

  it('prefers an exact attribute name over a wrapped one', () => {
    expect(
      getTraceProperties(
        makeTraceItemDetailsResponse([
          // Sorted the way the API returns it, so the wrapped key comes first.
          {name: 'tags[user.email,string]', type: 'str', value: 'wrapped@example.com'},
          {name: 'user.email', type: 'str', value: 'exact@example.com'},
        ])
      )?.user
    ).toEqual({field: 'user.email', value: 'exact@example.com'});
  });

  it('resolves the sentry-prefixed form of an attribute', () => {
    expect(
      getTraceProperties(
        makeTraceItemDetailsResponse([
          {name: 'sentry.environment', type: 'str', value: 'production'},
        ])
      )?.environment
    ).toBe('production');
  });

  it('prefers process.runtime.name/version over the deprecated runtime.name/version', () => {
    expect(
      getTraceProperties(
        makeTraceItemDetailsResponse([
          {name: 'process.runtime.name', type: 'str', value: 'CPython'},
          {name: 'process.runtime.version', type: 'str', value: '3.12.0'},
          {name: 'runtime.name', type: 'str', value: 'node'},
          {name: 'runtime.version', type: 'str', value: '18.0.0'},
        ])
      )?.runtime
    ).toEqual({name: 'CPython', version: '3.12.0'});
  });

  it('does not pair a runtime name with a version from the other attribute family', () => {
    expect(
      getTraceProperties(
        makeTraceItemDetailsResponse([
          {name: 'process.runtime.name', type: 'str', value: 'CPython'},
          {name: 'runtime.version', type: 'str', value: '18.0.0'},
        ])
      )?.runtime
    ).toEqual({name: 'CPython', version: undefined});
  });

  it('keeps the deprecated runtime name and version paired when both versions exist', () => {
    expect(
      getTraceProperties(
        makeTraceItemDetailsResponse([
          {name: 'runtime.name', type: 'str', value: 'node'},
          {name: 'process.runtime.version', type: 'str', value: '3.12.0'},
          {name: 'runtime.version', type: 'str', value: '18.0.0'},
        ])
      )?.runtime
    ).toEqual({name: 'node', version: '18.0.0'});
  });

  it('falls back through username, IP and ID when a span has no user email', () => {
    expect(
      getTraceProperties(
        makeTraceItemDetailsResponse([
          {name: 'user.ip', type: 'str', value: '10.0.0.12'},
          {name: 'user.id', type: 'str', value: '42'},
        ])
      )?.user
    ).toEqual({field: 'user.ip', value: '10.0.0.12'});
  });

  it('falls back to the username before the IP on a legacy event', () => {
    const event = EventFixture({
      user: {id: '42', username: 'jsmith', ip_address: '10.0.0.12'},
    });

    expect(getTraceProperties(event as any)?.user).toEqual({
      field: 'user.username',
      value: 'jsmith',
    });
  });

  it('drops os, browser, and runtime when the name attribute is missing', () => {
    expect(
      getTraceProperties(
        makeTraceItemDetailsResponse([
          {name: 'os.version', type: 'str', value: '10'},
          {name: 'browser.version', type: 'str', value: '120.0'},
          {name: 'runtime.version', type: 'str', value: '18.0.0'},
        ])
      )
    ).toMatchObject({os: undefined, browser: undefined, runtime: undefined});
  });

  it('reads contexts and tags from a legacy event', () => {
    const event = EventFixture({
      contexts: {
        runtime: {name: 'CPython', version: '3.12.0', type: 'runtime'},
        browser: {name: 'Chrome', version: '120.0', type: 'browser'},
        os: {name: 'Linux', version: '6.1', type: 'os'},
      },
      user: {id: '42', email: 'user@example.com'},
      tags: [
        {key: 'release', value: 'frontend@1.0.0'},
        {key: 'environment', value: 'production'},
      ],
    });

    expect(getTraceProperties(event as any)).toEqual({
      runtime: {name: 'CPython', version: '3.12.0'},
      browser: {name: 'Chrome', version: '120.0'},
      os: {name: 'Linux', version: '6.1'},
      user: {field: 'user.email', value: 'user@example.com'},
      release: 'frontend@1.0.0',
      environment: 'production',
    });
  });

  it('hides the client browser on a meta-framework backend event', () => {
    const event = EventFixture({
      contexts: {
        browser: {name: 'Chrome', type: 'browser'},
        client_os: {name: 'macOS', type: 'os'},
        os: {name: 'Linux', type: 'os'},
      },
    });

    expect(getTraceProperties(event as any)?.browser).toBeUndefined();
  });
});

describe('getTraceMetadataItems', () => {
  const organization = OrganizationFixture();

  it('drops properties the root event does not have', () => {
    expect(
      getTraceMetadataItems({
        operation: undefined,
        organization,
        project: undefined,
        properties: null,
        replayId: undefined,
        startTimestamp: undefined,
      })
    ).toEqual([null, null, null, null, null, null, null, null, null, null]);
  });

  it('links the release to its details page', () => {
    const items = getTraceMetadataItems({
      operation: undefined,
      organization,
      project: {slug: 'project-slug', id: '7'},
      properties: {release: 'frontend@1.0.0+abcdef'},
      replayId: undefined,
      startTimestamp: undefined,
    });

    expect(items.find(item => item?.label === 'Release')).toMatchObject({
      type: 'link',
      value: '1.0.0 (abcdef)',
      tooltip: 'Release',
      to: {
        pathname: '/organizations/org-slug/explore/releases/frontend%401.0.0%2Babcdef/',
        query: {project: '7'},
      },
    });
  });

  it('links the replay by its short id', () => {
    const items = getTraceMetadataItems({
      operation: undefined,
      organization,
      project: undefined,
      properties: null,
      replayId: '761104e184c64d439ee1014b72b4d83b',
      startTimestamp: undefined,
    });

    expect(items.find(item => item?.label === 'Replay')).toMatchObject({
      type: 'link',
      value: '761104e1',
      tooltip: 'Replay',
      to: '/organizations/org-slug/explore/replays/761104e184c64d439ee1014b72b4d83b/',
    });
  });

  it('labels the operation visibly', () => {
    const items = getTraceMetadataItems({
      operation: 'http.server',
      organization,
      project: undefined,
      properties: null,
      replayId: undefined,
      startTimestamp: undefined,
    });

    expect(items.find(item => item?.label === 'Operation')).toEqual({
      type: 'text',
      label: 'Operation',
      value: 'http.server',
      mode: 'full',
    });
  });

  it.each([
    ['user.email', 'alice@example.com', 'User email'],
    ['user.username', 'jsmith', 'User username'],
    ['user.ip', '10.0.0.12', 'User IP'],
    ['user.id', '42', 'User ID'],
  ] as const)('names a user value read from %s', (field, value, label) => {
    const items = getTraceMetadataItems({
      operation: undefined,
      organization,
      project: undefined,
      properties: {user: {field, value}},
      replayId: undefined,
      startTimestamp: undefined,
    });

    expect(items).toContainEqual(expect.objectContaining({label, value, tooltip: label}));
  });
});
