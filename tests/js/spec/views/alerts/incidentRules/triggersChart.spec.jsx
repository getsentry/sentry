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
    const {organization, project} = initializeOrg();
    mountWithTheme(
      <TriggersChart
        api={api}
        organization={organization}
        projects={[project]}
        query="event.type:error"
        timeWindow={1}
        aggregate="count()"
        triggers={[]}
      />
    );

    await tick();

    expect(eventStatsMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: {
          interval: '1m',
          project: [2],
          query: 'event.type:error',
          statsPeriod: '10000m',
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
          statsPeriod: '10000m',
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
});
