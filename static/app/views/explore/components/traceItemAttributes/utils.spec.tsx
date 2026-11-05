import type {TraceItemResponseAttribute} from 'sentry/views/explore/hooks/useTraceItemDetails';

import {
  getTraceItemAttribute,
  getTraceItemAttributeName,
  isNumericAttribute,
  withRawAttributeRenderers,
} from './utils';

describe('getTraceItemAttributeName', () => {
  it.each([
    ['profile.id', 'sentry.profile_id'],
    ['profile_id', 'sentry.profile_id'],
    ['replay.id', 'sentry.replay_id'],
    ['replayId', 'sentry.replay_id'],
    ['replay_id', 'sentry.replay_id'],
    ['release', 'sentry.release'],
    ['sdk.name', 'sentry.sdk.name'],
    ['sdk.version', 'sentry.sdk.version'],
    ['span.op', 'sentry.op'],
    ['http.method', 'http.request.method'],
  ])('resolves %s through conventions metadata', (alias, rawName) => {
    expect(getTraceItemAttributeName(alias, true)).toBe(rawName);
    expect(getTraceItemAttributeName(alias, false)).toBe(alias);
  });

  it.each([
    ['message', 'sentry.body'],
    ['severity', 'sentry.severity_text'],
    ['severity_number', 'sentry.severity_number'],
    ['trace', 'sentry.trace_id'],
    ['span_id', 'sentry.span_id'],
    ['timestamp_precise', 'sentry.timestamp_precise'],
    ['observed_timestamp', 'sentry.observed_timestamp_nanos'],
    ['payload_size', 'sentry.payload_size_bytes'],
    ['message.template', 'sentry.message.template'],
    ['precise.start_ts', 'sentry.start_timestamp_precise'],
    ['precise.finish_ts', 'sentry.end_timestamp_precise'],
  ])('falls back to the backend mapping for %s', (alias, rawName) => {
    expect(getTraceItemAttributeName(alias, true)).toBe(rawName);
    expect(getTraceItemAttributeName(alias, false)).toBe(alias);
  });
});

describe('getTraceItemAttribute', () => {
  const attributes: TraceItemResponseAttribute[] = [
    {name: 'message', type: 'str', value: 'custom message'},
    {name: 'sentry.body', type: 'str', value: 'log message'},
    {name: 'custom.key', type: 'bool', value: false},
  ];

  it('uses only the search alias when the flag is disabled', () => {
    expect(getTraceItemAttribute(attributes, 'message', false)?.value).toBe(
      'custom message'
    );
    expect(getTraceItemAttribute(attributes.slice(1), 'message', false)).toBeUndefined();
  });

  it('uses only the raw name when the flag is enabled', () => {
    expect(getTraceItemAttribute(attributes, 'message', true)?.value).toBe('log message');
    expect(
      getTraceItemAttribute(attributes.slice(0, 1), 'message', true)
    ).toBeUndefined();
  });

  it('uses the metadata canonical name rather than a colliding alias', () => {
    const spanAttributes: TraceItemResponseAttribute[] = [
      {name: 'span.op', type: 'str', value: 'custom operation'},
      {name: 'sentry.op', type: 'str', value: 'http.server'},
    ];
    expect(getTraceItemAttribute(spanAttributes, 'span.op', true)?.value).toBe(
      'http.server'
    );
    expect(getTraceItemAttribute(spanAttributes, 'span.op', false)?.value).toBe(
      'custom operation'
    );
  });

  it('matches typed tags by query name without confusing colliding attributes', () => {
    const rawAttributes: TraceItemResponseAttribute[] = [
      {name: 'sentry.body', queryName: 'message', type: 'str', value: 'log message'},
      {
        name: 'message',
        queryName: 'tags[message,number]',
        type: 'int',
        value: 42,
      },
      {
        name: 'message',
        queryName: 'tags[message,string]',
        type: 'str',
        value: 'custom message',
      },
    ];

    expect(
      getTraceItemAttribute(rawAttributes, 'tags[message,string]', true)?.value
    ).toBe('custom message');
    expect(
      getTraceItemAttribute(rawAttributes, 'tags[message,number]', true)?.value
    ).toBe(42);
    expect(getTraceItemAttribute(rawAttributes, 'message', true)?.value).toBe(
      'log message'
    );
  });

  it('preserves custom names and falsy values', () => {
    expect(getTraceItemAttribute(attributes, 'custom.key', true)?.value).toBe(false);
    expect(getTraceItemAttributeName('tags[message,string]', true)).toBe(
      'tags[message,string]'
    );
    expect(getTraceItemAttributeName('toString', true)).toBe('toString');
  });

  it('handles missing attributes', () => {
    expect(getTraceItemAttribute(undefined, 'message', true)).toBeUndefined();
    expect(getTraceItemAttribute([], 'message', true)).toBeUndefined();
  });
});

describe('withRawAttributeRenderers', () => {
  it('returns the original map when the flag is disabled', () => {
    const renderers = {'profile.id': jest.fn()};
    expect(withRawAttributeRenderers(renderers, false)).toBe(renderers);
    expect(Object.hasOwn(renderers, 'sentry.profile_id')).toBe(false);
  });

  it.each([
    ['profile.id', 'sentry.profile_id'],
    ['profile_id', 'sentry.profile_id'],
    ['span.op', 'sentry.op'],
    ['http.method', 'http.request.method'],
    ['message', 'sentry.body'],
    ['trace', 'sentry.trace_id'],
    ['replayId', 'sentry.replay_id'],
    ['replay_id', 'sentry.replay_id'],
    ['precise.start_ts', 'sentry.start_timestamp_precise'],
    ['precise.finish_ts', 'sentry.end_timestamp_precise'],
    ['tags[sentry._internal.ingested_at,number]', 'sentry._internal.ingested_at'],
  ])('registers %s under %s without mutating the original map', (alias, rawName) => {
    const renderer = jest.fn();
    const renderers = {[alias]: renderer};
    const result = withRawAttributeRenderers(renderers, true);
    expect(Object.hasOwn(result, alias)).toBe(false);
    expect(result[rawName]).toBe(renderer);
    expect(Object.hasOwn(renderers, rawName)).toBe(false);
  });

  it('preserves explicit raw and custom renderers', () => {
    const aliasRenderer = jest.fn();
    const rawRenderer = jest.fn();
    const customRenderer = jest.fn();
    const result = withRawAttributeRenderers(
      {
        'profile.id': aliasRenderer,
        'sentry.profile_id': rawRenderer,
        'custom.key': customRenderer,
      },
      true
    );
    expect(result['sentry.profile_id']).toBe(rawRenderer);
    expect(result['custom.key']).toBe(customRenderer);
    expect(Object.hasOwn(result, 'sentry.custom.key')).toBe(false);
  });
});

describe('isNumericAttribute', () => {
  it('returns true for explicit int/float types', () => {
    expect(isNumericAttribute({value: '42', type: 'int'})).toBe(true);
    expect(isNumericAttribute({value: '3.14', type: 'float'})).toBe(true);
  });

  it('returns true for tags[name,number] keys', () => {
    expect(
      isNumericAttribute({
        value: '100',
        type: 'str',
        key: 'tags[code.line.number,number]',
      })
    ).toBe(true);
  });

  it('returns true for JS number values as a fallback', () => {
    expect(isNumericAttribute({value: 42, type: 'str'})).toBe(true);
  });

  it('returns false for null, bool, and plain strings', () => {
    expect(isNumericAttribute({value: null, type: 'int'})).toBe(false);
    expect(isNumericAttribute({value: 'true', type: 'bool'})).toBe(false);
    expect(isNumericAttribute({value: 'hello', type: 'str', key: 'message'})).toBe(false);
  });
});
