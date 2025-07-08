import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {WidgetFixture} from 'sentry-fixture/widget';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {DisplayType} from 'sentry/views/dashboards/types';

import SpansWidgetQueries from './spansWidgetQueries';

describe('spansWidgetQueries', () => {
  const {organization} = initializeOrg();
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
      </SpansWidgetQueries>,
      {organization}
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
      </SpansWidgetQueries>,
      {organization}
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
