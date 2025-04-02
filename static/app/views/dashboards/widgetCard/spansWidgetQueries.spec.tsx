import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {WidgetFixture} from 'sentry-fixture/widget';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {DisplayType} from 'sentry/views/dashboards/types';
import {OrganizationContext} from 'sentry/views/organizationContext';

import SpansWidgetQueries from './spansWidgetQueries';

describe('spansWidgetQueries', () => {
  const api = new MockApiClient();
  let widget = WidgetFixture();
  const selection = PageFiltersFixture();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    widget = WidgetFixture();
  });

  it('calculates the confidence for a single series', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: {
        confidence: [
          [1, [{count: 'low'}]],
          [2, [{count: 'low'}]],
          [3, [{count: 'low'}]],
        ],
        data: [],
      },
    });

    render(
      <SpansWidgetQueries
        api={api}
        widget={widget}
        selection={selection}
        dashboardFilters={{}}
      >
        {({confidence}) => <div>{confidence}</div>}
      </SpansWidgetQueries>
    );

    expect(await screen.findByText('low')).toBeInTheDocument();
  });

  it('calculates the confidence for a multi series', async () => {
    widget = WidgetFixture({
      queries: [
        {
          name: '',
          aggregates: ['a', 'b'],
          fields: ['a', 'b'],
          columns: [],
          conditions: '',
          orderby: '',
        },
      ],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: {
        a: {
          confidence: [
            [1, [{count: 'high'}]],
            [2, [{count: 'high'}]],
            [3, [{count: 'high'}]],
          ],
          data: [],
        },
        b: {
          confidence: [
            [1, [{count: 'high'}]],
            [2, [{count: 'high'}]],
            [3, [{count: 'high'}]],
          ],
          data: [],
        },
      },
    });

    render(
      <SpansWidgetQueries
        api={api}
        widget={widget}
        selection={selection}
        dashboardFilters={{}}
      >
        {({confidence}) => <div>{confidence}</div>}
      </SpansWidgetQueries>
    );

    expect(await screen.findByText('high')).toBeInTheDocument();
  });

  it('triggers a preflight and then a best effort request', async () => {
    widget = WidgetFixture({
      queries: [
        {
          name: '',
          aggregates: ['a', 'b'],
          fields: ['a', 'b'],
          columns: [],
          conditions: '',
          orderby: '',
        },
      ],
      displayType: DisplayType.LINE,
    });
    const eventsStatsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: {
        data: [
          [1, [{count: 1}]],
          [2, [{count: 2}]],
          [3, [{count: 3}]],
        ],
      },
    });

    render(
      <OrganizationContext.Provider
        value={OrganizationFixture({
          features: ['visibility-explore-progressive-loading'],
        })}
      >
        <SpansWidgetQueries
          api={api}
          widget={widget}
          selection={selection}
          dashboardFilters={{}}
        >
          {({timeseriesResults}) => <div>{timeseriesResults?.[0]?.data?.[0]?.value}</div>}
        </SpansWidgetQueries>
      </OrganizationContext.Provider>
    );

    expect(await screen.findByText('1')).toBeInTheDocument();
    expect(eventsStatsMock).toHaveBeenCalledTimes(2);
    expect(eventsStatsMock).toHaveBeenNthCalledWith(
      1,
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        query: expect.objectContaining({
          sampling: 'PREFLIGHT',
        }),
      })
    );
    expect(eventsStatsMock).toHaveBeenNthCalledWith(
      2,
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        query: expect.objectContaining({
          sampling: 'BEST_EFFORT',
        }),
      })
    );
  });
});
