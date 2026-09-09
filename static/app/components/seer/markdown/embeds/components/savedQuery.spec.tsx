import {UserFixture} from 'sentry-fixture/user';

import {screen} from 'sentry-test/reactTestingLibrary';

import {getEmbedLinkHref, renderEmbed} from './resourceEmbedTestUtils';

function savedQueryResponse(overrides: Record<string, unknown> = {}) {
  return {
    id: 312,
    name: 'Slow checkout spans',
    dataset: 'spans',
    projects: [1],
    environment: ['prod'],
    range: '7d',
    interval: '1h',
    starred: true,
    position: null,
    dateAdded: '2026-08-01T00:00:00Z',
    dateUpdated: '2026-08-27T00:00:00Z',
    lastVisited: '2026-08-27T00:00:00Z',
    createdBy: UserFixture({name: 'A Teammate'}),
    query: [
      {
        query: 'span.op:http.client',
        fields: ['span.description', 'span.duration'],
        mode: 'aggregate',
        orderby: '-p95_span_duration',
        groupby: ['span.op'],
        visualize: [{yAxes: ['p95(span.duration)']}],
        aggregateField: [{groupBy: 'span.op'}, {yAxes: ['p95(span.duration)']}],
      },
    ],
    ...overrides,
  };
}

describe('saved query embed', () => {
  it('links inline without fetching the saved query', () => {
    const request = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/explore/saved/312/',
      body: savedQueryResponse(),
    });

    const href = getEmbedLinkHref('savedQuery', 'Slow checkout spans', {
      id: '312',
      dataset: 'spans',
      name: 'Slow checkout spans',
    });

    expect(href).toContain('/organizations/org-slug/explore/traces/');
    // An inline mention stays cheap; only the block level fetches.
    expect(request).not.toHaveBeenCalled();
  });

  it('renders the saved query with a link that restores its parameters', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/explore/saved/312/',
      body: savedQueryResponse(),
    });

    renderEmbed({name: 'savedQuery', data: {id: '312', dataset: 'spans'}});

    const link = await screen.findByRole('link', {name: /Slow checkout spans/});
    const href = decodeURIComponent(link.getAttribute('href') ?? '');

    // The inline `?id=` link carries nothing but the id, which Explore reads
    // only for the page title — so that page opens on the viewer's own
    // defaults. The block has the definition, so its link restores the query
    // itself. `id` rides along for the title, as the canonical builder emits.
    expect(href).toContain('query=span.op:http.client');
    expect(href).toContain('statsPeriod=7d');
    expect(href).toContain('groupBy=span.op');
    expect(href).toContain('p95(span.duration)');
    expect(href).toContain('project=1');
    expect(href).toContain('environment=prod');

    expect(screen.getByText('Group by')).toBeInTheDocument();
    // Also appears in the formatted query above it.
    expect(screen.getAllByText('span.op').length).toBeGreaterThan(0);
    expect(screen.getByText('Visualize')).toBeInTheDocument();
    expect(screen.getByText('p95(span.duration)')).toBeInTheDocument();
    expect(screen.getByText(/A Teammate/)).toBeInTheDocument();
  });

  it('trusts the dataset the API reports over the one the tag claimed', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/explore/saved/312/',
      body: savedQueryResponse({dataset: 'logs'}),
    });

    // The model said spans; the saved query is actually a logs query.
    renderEmbed({name: 'savedQuery', data: {id: '312', dataset: 'spans'}});

    expect(await screen.findByText('Logs')).toBeInTheDocument();
  });

  // The saved-query API stamps `segment_spans` on queries the Discover ->
  // Explore migration translated, and `ai_conversations` on agents queries.
  // Both have to parse: an embed whose data fails schema validation renders
  // nothing at all, not a degraded link.
  it('renders a query migrated from Discover', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/explore/saved/312/',
      body: savedQueryResponse({dataset: 'segment_spans'}),
    });

    renderEmbed({name: 'savedQuery', data: {id: '312', dataset: 'segment_spans'}});

    // A legacy alias for spans, so it reads as Traces like any other spans query.
    expect(await screen.findByText('Traces')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: /Slow checkout spans/})).toBeInTheDocument();
  });

  it('renders an agents saved query', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/explore/saved/488/',
      body: savedQueryResponse({id: 488, dataset: 'ai_conversations'}),
    });

    renderEmbed({name: 'savedQuery', data: {id: '488', dataset: 'ai_conversations'}});

    expect(await screen.findByText('Conversations')).toBeInTheDocument();
    const link = await screen.findByRole('link', {name: /Slow checkout spans/});
    expect(link).toHaveAttribute(
      'href',
      expect.stringContaining('/organizations/org-slug/explore/agents/')
    );
  });

  it.each([
    ['segment_spans', '/organizations/org-slug/explore/traces/'],
    ['ai_conversations', '/organizations/org-slug/explore/agents/'],
  ])('links %s inline to its own surface', (dataset, pathname) => {
    const href = getEmbedLinkHref('savedQuery', 'A saved query', {
      id: '312',
      dataset,
      name: 'A saved query',
    });

    expect(href).toContain(pathname);
  });

  it('falls back to the inline link when the saved query cannot be loaded', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/explore/saved/999/',
      statusCode: 404,
      body: {detail: 'Not found'},
    });

    renderEmbed({
      name: 'savedQuery',
      data: {id: '999', dataset: 'spans', name: 'Deleted query'},
    });

    expect(await screen.findByRole('link', {name: /Deleted query/})).toBeInTheDocument();
  });
});
