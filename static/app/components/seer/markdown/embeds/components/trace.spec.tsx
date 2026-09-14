import {screen} from 'sentry-test/reactTestingLibrary';

import {getEmbedLinkHref, renderEmbed} from './resourceEmbedTestUtils';

describe('trace embed', () => {
  const traceId = 'a1b2c3d4e5f678901234567890abcdef';
  const timestamp = '2026-08-25T16:37:12Z';

  it('converts the ISO timestamp to unix seconds for the waterfall', () => {
    const href = getEmbedLinkHref('trace', 'Trace a1b2c3d4', {
      traceId,
      timestamp,
    });

    expect(href).toContain(`/explore/traces/trace/${traceId}/`);
    expect(href).toContain(`timestamp=${Date.parse(timestamp) / 1000}`);
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

  it('stays a link at block level instead of loading the waterfall', () => {
    // The waterfall is its own embed now, so a trace reference on its own line must not
    // expand into one — nor fetch the trace to try.
    const traceRequest = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/events-trace/${traceId}/`,
      body: {transactions: [], orphan_errors: []},
    });

    renderEmbed({name: 'trace', data: {traceId, timestamp}});

    expect(screen.getByRole('link', {name: 'Trace a1b2c3d4'})).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Search in trace')).not.toBeInTheDocument();
    expect(traceRequest).not.toHaveBeenCalled();
  });
});
