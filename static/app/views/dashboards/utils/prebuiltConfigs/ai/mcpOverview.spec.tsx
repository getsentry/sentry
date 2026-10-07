import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {VisualizationWidget} from 'sentry/views/dashboards/widgetCard/visualizationWidget';

import {MCP_OVERVIEW_PREBUILT_CONFIG} from './mcpOverview';

describe('MCP transport distribution', () => {
  const selection = PageFiltersFixture();
  const widget = MCP_OVERVIEW_PREBUILT_CONFIG.widgets.find(
    candidate => candidate.id === 'mcp-overview-transport-distribution'
  )!;

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

  it.each([
    {
      protocol: 'http',
      transport: 'tcp',
      label: 'http,tcp',
      filters: 'network.protocol.name:http network.transport:tcp',
    },
    {
      protocol: 'http',
      transport: 'quic',
      label: 'http,quic',
      filters: 'network.protocol.name:http network.transport:quic',
    },
    {
      protocol: 'http',
      transport: null,
      label: 'http,(no value)',
      filters: 'network.protocol.name:http !has:network.transport',
    },
    {
      protocol: null,
      transport: 'pipe',
      label: '(no value),pipe',
      filters: '!has:network.protocol.name network.transport:pipe',
    },
  ])(
    'links $label to its complete breakdown',
    async ({protocol, transport, label, filters}) => {
      const seriesRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events-stats/',
        body: {
          [`${protocol ?? 'None'},${transport ?? 'None'}`]: {
            data: [[1, [{count: 10}]]],
            meta: {fields: {'count()': 'integer'}, units: {}},
          },
        },
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events/',
        body: {
          data: [
            {
              'network.protocol.name': protocol,
              'network.transport': transport,
              'count()': 10,
            },
          ],
          meta: {
            fields: {
              'network.protocol.name': 'string',
              'network.transport': 'string',
              'count()': 'integer',
            },
            units: {},
          },
        },
      });

      render(<VisualizationWidget widget={widget} selection={selection} />, {
        organization: OrganizationFixture({features: ['visibility-explore-view']}),
      });

      const link = await screen.findByRole('link', {name: label});
      const url = new URL(link.getAttribute('href')!, 'https://sentry.io');
      expect(url.searchParams.get('query')).toContain(filters);
      expect(seriesRequest).toHaveBeenCalledWith(
        '/organizations/org-slug/events-stats/',
        expect.objectContaining({
          query: expect.objectContaining({
            field: ['network.protocol.name', 'network.transport', 'count()'],
            query:
              'span.op:mcp.server (has:network.protocol.name OR has:network.transport)',
          }),
        })
      );
    }
  );
});
