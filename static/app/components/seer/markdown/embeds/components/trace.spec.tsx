import {screen, waitFor} from 'sentry-test/reactTestingLibrary';

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

  it('renders the trace waterfall at block level', async () => {
    const traceRequest = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/events-trace/${traceId}/`,
      body: {transactions: [], orphan_errors: []},
    });
    const metaRequest = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/events-trace-meta/${traceId}/`,
      body: {
        errors: 0,
        performance_issues: 0,
        projects: 0,
        transactions: 0,
        transaction_child_count_map: [],
        span_count: 0,
        span_count_map: {},
      },
    });

    renderEmbed({name: 'trace', data: {traceId, timestamp}});

    expect(
      await screen.findByText(
        /We were unable to find any spans for this trace/,
        {},
        {timeout: 10_000}
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Trace a1b2c3d4'})).toHaveAttribute(
      'href',
      expect.stringContaining(`/explore/traces/trace/${traceId}/`)
    );
    await waitFor(() => {
      expect(traceRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: expect.objectContaining({
            referrer: 'api.seer.trace-waterfall-embed',
            timestamp: String(Date.parse(timestamp) / 1000),
          }),
        })
      );
      expect(metaRequest).toHaveBeenCalled();
    });
  });
});
