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
