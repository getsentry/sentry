import {getEmbedLinkHref} from './resourceEmbedTestUtils';

describe('trace embed', () => {
  const traceId = 'a1b2c3d4e5f678901234567890abcdef';

  it('converts the ISO timestamp to unix seconds for the waterfall', () => {
    const href = getEmbedLinkHref('trace', 'Trace a1b2c3d4', {
      traceId,
      timestamp: '2026-08-25T16:37:12Z',
    });

    expect(href).toContain(`/explore/traces/trace/${traceId}/`);
    expect(href).toContain(`timestamp=${Date.parse('2026-08-25T16:37:12Z') / 1000}`);
  });

  it('focuses a span when one is given', () => {
    expect(
      getEmbedLinkHref('trace', 'Trace a1b2c3d4', {traceId, spanId: 'abc123'})
    ).toContain('node=span-abc123');
  });

  it('omits trace query params that were not provided', () => {
    expect(getEmbedLinkHref('trace', 'Trace a1b2c3d4', {traceId})).toBe(
      `/organizations/org-slug/explore/traces/trace/${traceId}/`
    );
  });
});
