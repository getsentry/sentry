import {screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {getEmbedLinkHref, renderEmbed} from './resourceEmbedTestUtils';

describe('trace embed', () => {
  const traceId = 'a1b2c3d4e5f678901234567890abcdef';
  const timestamp = '2026-08-25T16:37:12Z';

  const originalSearch = window.location.search;

  afterEach(() => {
    window.history.replaceState({}, '', `/${originalSearch}`);
  });

  function mockTraceRequests() {
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

    return {traceRequest, metaRequest};
  }

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
    const {traceRequest, metaRequest} = mockTraceRequests();

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

  it('does not let the host page query string steer the trace fetch', async () => {
    // `useTrace`/`useTraceMeta` parse `location.search` themselves, so opting the waterfall out of
    // URL sync is not enough — the fetches need their own opt-out or the host page's event and
    // window params ride along.
    window.history.replaceState(
      {},
      '',
      '/?eventId=hosteventid&node=span-hostspan&limit=5&statsPeriod=90d'
    );
    const {traceRequest} = mockTraceRequests();

    renderEmbed({name: 'trace', data: {traceId}});

    await waitFor(() => {
      expect(traceRequest).toHaveBeenCalled();
    });

    expect(traceRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: expect.not.objectContaining({targetId: 'hosteventid'}),
      })
    );
    expect(traceRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: expect.not.objectContaining({limit: 5}),
      })
    );
    expect(traceRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: expect.not.objectContaining({statsPeriod: '90d'}),
      })
    );
  });

  it('ignores a host page timestamp when the embed carries none', async () => {
    window.history.replaceState({}, '', '/?timestamp=1111111111');
    const {traceRequest} = mockTraceRequests();

    renderEmbed({name: 'trace', data: {traceId}});

    await waitFor(() => {
      expect(traceRequest).toHaveBeenCalled();
    });

    expect(traceRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: expect.not.objectContaining({timestamp: '1111111111'}),
      })
    );
  });

  it('does not seed the embed search box from the host page query string', async () => {
    // The embed is rendered inside another page (a Seer response), so the surrounding page's
    // `?search=`/`?node=` must not steer it.
    window.history.replaceState({}, '', '/?search=http.client&node=span-hostspan');
    mockTraceRequests();

    renderEmbed({name: 'trace', data: {traceId, timestamp}});

    expect(
      await screen.findByPlaceholderText('Search in trace', {}, {timeout: 10_000})
    ).toHaveValue('');
  });
});
