import {useQueryState} from 'nuqs';

import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {parseAsUtcDateTime} from 'sentry/utils/url/parseAsUtcDateTime';

describe('parseAsUtcDateTime', () => {
  // Run in a timezone behind UTC so a value read as local time lands on a
  // different instant than the same value read as UTC.
  const originalTimezone = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = 'America/Los_Angeles';
  });
  afterAll(() => {
    process.env.TZ = originalTimezone;
  });

  function renderParam(query: Record<string, string>) {
    return renderHookWithProviders(() => useQueryState('start', parseAsUtcDateTime), {
      initialRouterConfig: {location: {pathname: '/mock-pathname/', query}},
    });
  }

  it('reads a value without an offset as UTC', () => {
    const {result} = renderParam({start: '2026-09-29T17:10:45'});

    expect(result.current[0]?.toISOString()).toBe('2026-09-29T17:10:45.000Z');
  });

  it('reads a UTC value', () => {
    const {result} = renderParam({start: '2026-09-29T17:10:45.855Z'});

    expect(result.current[0]?.toISOString()).toBe('2026-09-29T17:10:45.855Z');
  });

  it('respects an explicit offset', () => {
    const {result} = renderParam({start: '2026-09-29T10:10:45-07:00'});

    expect(result.current[0]?.toISOString()).toBe('2026-09-29T17:10:45.000Z');
  });

  it('falls back to null for an invalid value', () => {
    const {result} = renderParam({start: 'not-a-date'});

    expect(result.current[0]).toBeNull();
  });
});
