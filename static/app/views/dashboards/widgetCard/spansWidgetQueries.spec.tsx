import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {WidgetFixture} from 'sentry-fixture/widget';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

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

  function mockPreflightAndBestEffortRequests({
    type,
    preflightData,
    bestEffortData,
  }: {
    bestEffortData: Record<string, any>;
    preflightData: Record<string, any>;
    type: 'events' | 'events-stats';
  }) {
    const preflightMock = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/${type}/`,
      body: preflightData,
      match: [
        function (_url: string, options: Record<string, any>) {
          return options.query.sampling === 'PREFLIGHT';
        },
      ],
    });
    const bestEffortMock = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/${type}/`,
      body: bestEffortData,
      match: [
        function (_url: string, options: Record<string, any>) {
          return options.query.sampling === 'BEST_EFFORT';
        },
      ],
    });

    return {preflightMock, bestEffortMock};
  }

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

  it('triggers a preflight and then a best effort request for timeseries charts', async () => {
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
    const {preflightMock, bestEffortMock} = mockPreflightAndBestEffortRequests({
      type: 'events-stats',
      preflightData: {
        data: [
          [1, [{count: 1}]],
          [2, [{count: 2}]],
          [3, [{count: 3}]],
        ],
      },
      bestEffortData: {
        data: [
          [1, [{count: 100}]],
          [2, [{count: 200}]],
          [3, [{count: 300}]],
        ],
      },
    });

    const {rerender} = render(
      <OrganizationContext.Provider
        value={OrganizationFixture({
          features: ['visibility-explore-progressive-loading'],
        })}
      >
        <SpansWidgetQueries
          api={api}
          widget={widget}
          selection={{
            ...selection,
            datetime: {period: '24hr', end: null, start: null, utc: null},
          }}
          dashboardFilters={{}}
        >
          {({timeseriesResults}) => <div>{timeseriesResults?.[0]?.data?.[0]?.value}</div>}
        </SpansWidgetQueries>
      </OrganizationContext.Provider>
    );

    // Best effort data is eventually returned
    expect(await screen.findByText('100')).toBeInTheDocument();

    expect(preflightMock).toHaveBeenCalledTimes(1);
    expect(bestEffortMock).toHaveBeenCalledTimes(1);

    expect(preflightMock).toHaveBeenCalledWith(
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        query: expect.objectContaining({
          sampling: 'PREFLIGHT',
        }),
      })
    );
    expect(bestEffortMock).toHaveBeenCalledWith(
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        query: expect.objectContaining({
          sampling: 'BEST_EFFORT',
        }),
      })
    );

    // Reset the mocks so we can test that the rerender only triggers two requests
    MockApiClient.clearMockResponses();
    const {
      preflightMock: rerenderedPreflightMock,
      bestEffortMock: rerenderedBestEffortMock,
    } = mockPreflightAndBestEffortRequests({
      type: 'events-stats',
      preflightData: {
        data: [
          [1, [{count: '4'}]],
          [2, [{count: '5'}]],
          [3, [{count: '6'}]],
        ],
      },
      bestEffortData: {
        data: [
          [1, [{count: '400'}]],
          [2, [{count: '500'}]],
          [3, [{count: '600'}]],
        ],
      },
    });

    // Rerender the component and check that the preflight is called before the best effort
    rerender(
      <OrganizationContext.Provider
        value={OrganizationFixture({
          features: ['visibility-explore-progressive-loading'],
        })}
      >
        <SpansWidgetQueries
          api={api}
          widget={widget}
          selection={{
            ...selection,
            datetime: {period: '1hr', end: null, start: null, utc: null},
          }}
          dashboardFilters={{}}
        >
          {({timeseriesResults}) => <div>{timeseriesResults?.[0]?.data?.[0]?.value}</div>}
        </SpansWidgetQueries>
      </OrganizationContext.Provider>
    );

    // Best effort data is eventually returned
    await waitFor(() => {
      expect(screen.getByText('400')).toBeInTheDocument();
    });

    expect(rerenderedPreflightMock).toHaveBeenCalledTimes(1);
    expect(rerenderedBestEffortMock).toHaveBeenCalledTimes(1);

    expect(rerenderedPreflightMock).toHaveBeenCalledWith(
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        query: expect.objectContaining({
          sampling: 'PREFLIGHT',
        }),
      })
    );
    expect(rerenderedBestEffortMock).toHaveBeenCalledWith(
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        query: expect.objectContaining({
          sampling: 'BEST_EFFORT',
        }),
      })
    );
  });

  it('triggers a preflight and then a best effort request for tables', async () => {
    widget = WidgetFixture({
      queries: [
        {
          name: '',
          aggregates: ['a'],
          fields: ['a'],
          columns: [],
          conditions: '',
          orderby: '',
        },
      ],
      displayType: DisplayType.TABLE,
    });
    const {preflightMock, bestEffortMock} = mockPreflightAndBestEffortRequests({
      type: 'events',
      preflightData: {
        data: [{a: 'preflight'}],
      },
      bestEffortData: {
        data: [{a: 'best effort'}],
      },
    });

    const {rerender} = render(
      <OrganizationContext.Provider
        value={OrganizationFixture({
          features: ['visibility-explore-progressive-loading'],
        })}
      >
        <SpansWidgetQueries
          api={api}
          widget={widget}
          selection={{
            ...selection,
            datetime: {period: '24hr', end: null, start: null, utc: null},
          }}
          dashboardFilters={{}}
        >
          {({tableResults}) => <div>{tableResults?.[0]?.data?.[0]?.a}</div>}
        </SpansWidgetQueries>
      </OrganizationContext.Provider>
    );

    // Best effort data is eventually returned
    await waitFor(() => {
      expect(screen.getByText('best effort')).toBeInTheDocument();
    });

    expect(preflightMock).toHaveBeenCalledTimes(1);
    expect(bestEffortMock).toHaveBeenCalledTimes(1);

    expect(preflightMock).toHaveBeenCalledWith(
      '/organizations/org-slug/events/',
      expect.objectContaining({
        query: expect.objectContaining({
          sampling: 'PREFLIGHT',
        }),
      })
    );
    expect(bestEffortMock).toHaveBeenCalledWith(
      '/organizations/org-slug/events/',
      expect.objectContaining({
        query: expect.objectContaining({
          sampling: 'BEST_EFFORT',
        }),
      })
    );

    // Reset the mocks so we can test that the rerender only triggers two requests
    MockApiClient.clearMockResponses();
    const {
      preflightMock: rerenderedPreflightMock,
      bestEffortMock: rerenderedBestEffortMock,
    } = mockPreflightAndBestEffortRequests({
      type: 'events',
      preflightData: {
        data: [{a: 'new preflight'}],
      },
      bestEffortData: {
        data: [{a: 'new best effort'}],
      },
    });

    // Rerender the component and check that the preflight is called before the best effort
    rerender(
      <OrganizationContext.Provider
        value={OrganizationFixture({
          features: ['visibility-explore-progressive-loading'],
        })}
      >
        <SpansWidgetQueries
          api={api}
          widget={widget}
          selection={{
            ...selection,
            datetime: {period: '1hr', end: null, start: null, utc: null},
          }}
          dashboardFilters={{}}
        >
          {({tableResults}) => <div>{tableResults?.[0]?.data?.[0]?.a}</div>}
        </SpansWidgetQueries>
      </OrganizationContext.Provider>
    );

    // Best effort data is eventually returned
    expect(await screen.findByText('new best effort')).toBeInTheDocument();

    expect(rerenderedPreflightMock).toHaveBeenCalledTimes(1);
    expect(rerenderedBestEffortMock).toHaveBeenCalledTimes(1);

    expect(rerenderedPreflightMock).toHaveBeenCalledWith(
      '/organizations/org-slug/events/',
      expect.objectContaining({
        query: expect.objectContaining({
          sampling: 'PREFLIGHT',
        }),
      })
    );
    expect(rerenderedBestEffortMock).toHaveBeenCalledWith(
      '/organizations/org-slug/events/',
      expect.objectContaining({
        query: expect.objectContaining({
          sampling: 'BEST_EFFORT',
        }),
      })
    );
  });

  it('triggers a normal mode request for charts', async () => {
    widget = WidgetFixture({
      queries: [
        {
          name: '',
          aggregates: ['a'],
          fields: ['a'],
          columns: [],
          conditions: '',
          orderby: '',
        },
      ],
      displayType: DisplayType.LINE,
    });

    const normalModeMock = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/events-stats/`,
      body: {
        data: [
          [1, [{count: 1}]],
          [2, [{count: 2}]],
          [3, [{count: 3}]],
        ],
      },
      match: [
        function (_url: string, options: Record<string, any>) {
          return options.query.sampling === 'NORMAL';
        },
      ],
    });

    render(
      <OrganizationContext.Provider
        value={OrganizationFixture({
          features: ['visibility-explore-progressive-loading-normal-sampling-mode'],
        })}
      >
        <SpansWidgetQueries
          api={api}
          widget={widget}
          selection={{
            ...selection,
            datetime: {period: '24hr', end: null, start: null, utc: null},
          }}
          dashboardFilters={{}}
        >
          {({timeseriesResults}) => <div>{timeseriesResults?.[0]?.data?.[0]?.value}</div>}
        </SpansWidgetQueries>
      </OrganizationContext.Provider>
    );

    expect(await screen.findByText('1')).toBeInTheDocument();

    expect(normalModeMock).toHaveBeenCalledWith(
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        query: expect.objectContaining({
          sampling: 'NORMAL',
        }),
      })
    );
  });

  it('triggers a normal mode request for tables', async () => {
    widget = WidgetFixture({
      queries: [
        {
          name: '',
          aggregates: ['a'],
          fields: ['a'],
          columns: [],
          conditions: '',
          orderby: '',
        },
      ],
      displayType: DisplayType.TABLE,
    });

    const normalModeMock = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/events/`,
      body: {
        data: [{a: 'normal mode'}],
      },
      match: [
        function (_url: string, options: Record<string, any>) {
          return options.query.sampling === 'NORMAL';
        },
      ],
    });

    render(
      <OrganizationContext.Provider
        value={OrganizationFixture({
          features: ['visibility-explore-progressive-loading-normal-sampling-mode'],
        })}
      >
        <SpansWidgetQueries
          api={api}
          widget={widget}
          selection={{
            ...selection,
            datetime: {period: '24hr', end: null, start: null, utc: null},
          }}
          dashboardFilters={{}}
        >
          {({tableResults}) => <div>{tableResults?.[0]?.data?.[0]?.a}</div>}
        </SpansWidgetQueries>
      </OrganizationContext.Provider>
    );

    expect(await screen.findByText('normal mode')).toBeInTheDocument();

    expect(normalModeMock).toHaveBeenCalledWith(
      '/organizations/org-slug/events/',
      expect.objectContaining({
        query: expect.objectContaining({
          sampling: 'NORMAL',
        }),
      })
    );
  });
});
