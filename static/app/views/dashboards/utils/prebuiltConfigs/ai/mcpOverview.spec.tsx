import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';

import {render, screen} from 'sentry-test/reactTestingLibrary';

// Load the real spans config before the widget's dataset import cycle.
import 'sentry/views/dashboards/datasetConfig/spans';
import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {WidgetType} from 'sentry/views/dashboards/types';
import {VisualizationWidget} from 'sentry/views/dashboards/widgetCard/visualizationWidget';

import {MCP_OVERVIEW_PREBUILT_CONFIG} from './mcpOverview';

const widget = MCP_OVERVIEW_PREBUILT_CONFIG.widgets.find(
  candidate => candidate.id === 'mcp-overview-transport-distribution'
)!;
const selection = PageFiltersFixture();

function mockTransportRequests() {
  return widget.queries.map((query, index) => {
    const count = index === 0 ? 21 : 5;
    const grouped = query.columns.length > 0;
    const meta = {
      fields: {'mcp.transport': 'string', 'count()': 'integer'},
      units: {},
    };
    const match = [
      (_url: string, options: {query?: {query?: string}}) =>
        options.query?.query?.includes(query.conditions) ?? false,
    ];
    const seriesRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      match,
      body: grouped
        ? {
            CustomHTTPTransport: {data: [[1, [{count: 30}]]], meta},
            custom: {data: [[1, [{count: 7}]]], meta},
            None: {data: [[1, [{count: 2}]]], meta},
          }
        : {data: [[1, [{count}]]], meta},
    });
    const tableRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      match,
      body: {
        data: grouped
          ? [
              {'mcp.transport': 'CustomHTTPTransport', 'count()': 30},
              {'mcp.transport': 'custom', 'count()': 7},
              {'mcp.transport': null, 'count()': 2},
            ]
          : [{'count()': count}],
        meta,
      },
    });
    return {seriesRequest, tableRequest};
  });
}

describe('MCP Transport Distribution', () => {
  beforeEach(() => {
    PageFiltersStore.onInitializeUrlState(selection);
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/stats/',
      body: [],
    });
  });

  afterEach(() => {
    PageFiltersStore.reset();
  });

  it('counts standard transports together and preserves custom names in the existing chart', async () => {
    const requests = mockTransportRequests();

    render(<VisualizationWidget widget={widget} selection={selection} />, {
      organization: OrganizationFixture({features: ['visibility-explore-view']}),
    });

    for (const [label, count] of [
      ['http', '21'],
      ['stdio', '5'],
      ['CustomHTTPTransport', '30'],
      ['custom', '7'],
      ['(no value)', '2'],
    ] as const) {
      const link = await screen.findByRole('link', {name: label});
      expect(screen.getByText(count).previousElementSibling).toContainElement(link);
    }
    expect(screen.queryByText('tcp')).not.toBeInTheDocument();
    expect(screen.queryByText('pipe')).not.toBeInTheDocument();
    expect(widget.title).toBe('Transport Distribution');
    expect(MCP_OVERVIEW_PREBUILT_CONFIG.widgets).toHaveLength(7);

    // Standard implementations are aggregated by the API, before any top-N limit.
    const httpFilter =
      'span.op:mcp.server mcp.transport:[http,sse,StreamableHTTPServerTransport,NodeStreamableHTTPServerTransport,WebStandardStreamableHTTPServerTransport,PerRequestHTTPServerTransport,SSEServerTransport,SseServerTransport]';
    const stdioFilter = 'span.op:mcp.server mcp.transport:[stdio,StdioServerTransport]';
    for (const [index, query] of [httpFilter, stdioFilter].entries()) {
      expect(requests[index]!.seriesRequest).toHaveBeenCalledWith(
        '/organizations/org-slug/events-stats/',
        expect.objectContaining({
          query: expect.objectContaining({yAxis: ['count()'], query}),
        })
      );
      expect(requests[index]!.tableRequest).toHaveBeenCalledWith(
        '/organizations/org-slug/events/',
        expect.objectContaining({
          query: expect.objectContaining({field: 'count()', query}),
        })
      );
    }
    expect(requests[2]!.seriesRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        query: expect.objectContaining({
          field: ['mcp.transport', 'count()'],
          query:
            'span.op:mcp.server (!has:mcp.transport OR !mcp.transport:[http,sse,StreamableHTTPServerTransport,NodeStreamableHTTPServerTransport,WebStandardStreamableHTTPServerTransport,PerRequestHTTPServerTransport,SSEServerTransport,SseServerTransport,stdio,StdioServerTransport])',
        }),
      })
    );

    for (const [label, filter] of [
      ['http', httpFilter],
      ['stdio', stdioFilter],
    ] as const) {
      const link = screen.getByRole('link', {name: label});
      const url = new URL(link.getAttribute('href')!, 'https://sentry.io');
      expect(url.searchParams.get('query')).toBe(filter);
    }
    for (const [label, filter] of [
      ['CustomHTTPTransport', 'mcp.transport:CustomHTTPTransport'],
      ['custom', 'mcp.transport:custom'],
      ['(no value)', '!has:mcp.transport'],
    ] as const) {
      const link = screen.getByRole('link', {name: label});
      const url = new URL(link.getAttribute('href')!, 'https://sentry.io');
      const query = url.searchParams.get('query')!;
      expect(query.replaceAll(' ', '')).toContain(
        widget.queries[2]!.conditions.replaceAll(' ', '')
      );
      expect(query.endsWith(filter)).toBe(true);
    }
  });

  it('keeps dashboard filters when opening each transport in Explore', async () => {
    mockTransportRequests();

    render(
      <VisualizationWidget
        widget={widget}
        selection={selection}
        dashboardFilters={{
          globalFilter: [
            {
              dataset: WidgetType.SPANS,
              tag: {key: 'mcp.client.name', name: 'mcp.client.name'},
              value: 'mcp.client.name:test-client',
            },
          ],
        }}
      />,
      {organization: OrganizationFixture({features: ['visibility-explore-view']})}
    );

    for (const label of ['http', 'stdio', 'CustomHTTPTransport', '(no value)']) {
      const link = await screen.findByRole('link', {name: label});
      const url = new URL(link.getAttribute('href')!, 'https://sentry.io');
      expect(url.searchParams.get('query')).toContain('mcp.client.name:test-client');
    }
  });
});
