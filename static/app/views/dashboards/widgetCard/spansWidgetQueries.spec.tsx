import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';
import {WidgetFixture} from 'sentry-fixture/widget';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';

import {SpansWidgetQueries} from './spansWidgetQueries';

describe('spansWidgetQueries', () => {
  const {organization} = initializeOrg();
  let widget = WidgetFixture();
  const selection = PageFiltersFixture();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    widget = WidgetFixture();
    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState(selection);
  });

  it.isKnownFlake('calculates the confidence for a multi series', async () => {
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
    const highConfidence = [
      {timestamp: 1000, value: 1, confidence: 'high' as const},
      {timestamp: 2000, value: 2, confidence: 'high' as const},
      {timestamp: 3000, value: 3, confidence: 'high' as const},
    ];
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-timeseries/',
      body: {
        timeSeries: [
          TimeSeriesFixture({yAxis: 'a', values: highConfidence}),
          TimeSeriesFixture({yAxis: 'b', values: highConfidence}),
        ],
      },
    });

    render(
      <SpansWidgetQueries widget={widget} dashboardFilters={{}}>
        {({confidence}) => <div>{confidence}</div>}
      </SpansWidgetQueries>,
      {organization}
    );

    expect(await screen.findByText('high')).toBeInTheDocument();
  });

  it('calculates the confidence for a single series', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-timeseries/',
      body: {
        timeSeries: [
          TimeSeriesFixture({
            yAxis: 'count()',
            meta: {
              valueType: 'integer',
              valueUnit: null,
              interval: 1000,
              dataScanned: 'partial',
            },
            values: [
              {timestamp: 1000, value: 1, confidence: 'low'},
              {timestamp: 2000, value: 2, confidence: 'low'},
              {timestamp: 3000, value: 3, confidence: 'low'},
            ],
          }),
        ],
      },
    });

    render(
      <SpansWidgetQueries widget={widget} dashboardFilters={{}}>
        {({confidence, dataScanned}) => (
          <div>
            {confidence}:{dataScanned}
          </div>
        )}
      </SpansWidgetQueries>,
      {organization}
    );

    expect(await screen.findByText('low:partial')).toBeInTheDocument();
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
      url: '/organizations/org-slug/events-timeseries/',
      body: {timeSeries: [TimeSeriesFixture({yAxis: 'a'})]},
      match: [
        function (_url: string, options: Record<string, any>) {
          return options.query.sampling === 'NORMAL';
        },
      ],
    });

    PageFiltersStore.onInitializeUrlState({
      ...selection,
      datetime: {period: '24hr', end: null, start: null, utc: null},
    });

    render(
      <SpansWidgetQueries widget={widget} dashboardFilters={{}}>
        {({timeseriesResults}) => <div>{timeseriesResults?.length}</div>}
      </SpansWidgetQueries>,
      {organization}
    );

    expect(await screen.findByText('1')).toBeInTheDocument();

    expect(normalModeMock).toHaveBeenCalledWith(
      '/organizations/org-slug/events-timeseries/',
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
      url: '/organizations/org-slug/events/',
      body: {
        data: [{a: 'normal mode'}],
      },
      match: [
        function (_url: string, options: Record<string, any>) {
          return options.query.sampling === 'NORMAL';
        },
      ],
    });

    PageFiltersStore.onInitializeUrlState({
      ...selection,
      datetime: {period: '24hr', end: null, start: null, utc: null},
    });

    render(
      <SpansWidgetQueries widget={widget} dashboardFilters={{}}>
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

  it('skips the request and surfaces an error for an invalid series _if filter', async () => {
    const seriesMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-timeseries/',
      body: {timeSeries: []},
    });
    widget = WidgetFixture({
      displayType: DisplayType.LINE,
      widgetType: WidgetType.SPANS,
      queries: [
        {
          name: '',
          aggregates: ['avg_if(``,span.duration)'],
          fields: ['avg_if(``,span.duration)'],
          columns: [],
          conditions: '',
          orderby: '',
        },
      ],
    });

    render(
      <SpansWidgetQueries widget={widget} dashboardFilters={{}}>
        {({errorMessage, loading}) => (
          <div>
            {loading ? 'loading' : 'idle'}:{errorMessage}
          </div>
        )}
      </SpansWidgetQueries>,
      {
        organization: OrganizationFixture(),
      }
    );

    expect(await screen.findByText('idle:Invalid series filter')).toBeInTheDocument();
    expect(seriesMock).not.toHaveBeenCalled();
  });
});
