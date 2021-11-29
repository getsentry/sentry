import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountWithTheme} from 'sentry-test/reactTestingLibrary';

import {Client} from 'sentry/api';
import AreaChart from 'sentry/components/charts/areaChart';
import TriggersChart from 'sentry/views/alerts/incidentRules/triggers/chart';

jest.mock('sentry/components/charts/areaChart');

describe('Incident Rules Create', () => {
  let eventStatsMock;
  let eventCountsMock;
  let api;

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    AreaChart.default = jest.fn(() => null);
    api = new Client();
    eventStatsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: TestStubs.EventsStats(),
    });
    eventCountsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-meta/',
      body: {count: 5},
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('renders a metric', async () => {
    const {organization, project, routerContext} = initializeOrg();
    mountWithTheme(
      <TriggersChart
        api={api}
        organization={organization}
        projects={[project]}
        query="event.type:error"
        timeWindow={1}
        aggregate="count()"
        triggers={[]}
      />,
      {context: routerContext}
    );

    await tick();

    expect(eventStatsMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: {
          interval: '1m',
          project: [2],
          query: 'event.type:error',
          statsPeriod: '1d',
          yAxis: 'count()',
          referrer: 'api.organization-event-stats',
        },
      })
    );

    expect(eventCountsMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: {
          project: ['2'],
          query: 'event.type:error',
          statsPeriod: '1d',
          environment: [],
        },
      })
    );

    expect(AreaChart).toHaveBeenCalledWith(
      expect.objectContaining({
        series: [{data: expect.objectContaining({length: 1}), seriesName: 'count()'}],
      }),
      expect.anything()
    );
  });

  it('renders bucketed metric aggregate lines when there is many datapoints', async () => {
    const {organization, project, routerContext} = initializeOrg({
      organization: {
        features: ['metric-alert-builder-aggregate'],
      },
    });

    const data = Array(1200)
      .fill(null)
      .map(() => [new Date(), [{count: 10}]]);
    eventStatsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: TestStubs.EventsStats({data}),
    });
    mountWithTheme(
      <TriggersChart
        api={api}
        organization={organization}
        projects={[project]}
        query="event.type:error"
        timeWindow={1}
        aggregate="count()"
        triggers={[]}
      />,
      {context: routerContext}
    );

    await tick();

    expect(eventStatsMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: {
          interval: '1m',
          project: [2],
          query: 'event.type:error',
          statsPeriod: '1d',
          yAxis: 'count()',
          referrer: 'api.organization-event-stats',
        },
      })
    );

    expect(eventCountsMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: {
          project: ['2'],
          query: 'event.type:error',
          statsPeriod: '1d',
          environment: [],
        },
      })
    );

    // "series" accessed directly to assist with jest diff
    expect(AreaChart.mock.calls[0][0].series).toEqual([
      {data: expect.anything(), seriesName: 'count()'},
      {data: expect.anything(), seriesName: 'Minimum'},
      {data: expect.anything(), seriesName: 'Average'},
      {data: expect.anything(), seriesName: 'Maximum'},
    ]);
    expect(AreaChart.mock.calls[0][0].series[0].data).toHaveLength(1199);
    expect(AreaChart.mock.calls[0][0].series[1].data).toHaveLength(239);
    expect(AreaChart.mock.calls[0][0].series[2].data).toHaveLength(239);
    expect(AreaChart.mock.calls[0][0].series[3].data).toHaveLength(239);
  });
});
