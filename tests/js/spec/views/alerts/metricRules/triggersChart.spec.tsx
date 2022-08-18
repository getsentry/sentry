import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {Client} from 'sentry/api';
import TriggersChart from 'sentry/views/alerts/rules/metric/triggers/chart';
import {
  AlertRuleComparisonType,
  AlertRuleThresholdType,
  Dataset,
} from 'sentry/views/alerts/rules/metric/types';

describe('Incident Rules Create', () => {
  const eventStatsMock = MockApiClient.addMockResponse({
    url: '/organizations/org-slug/events-stats/',
    body: TestStubs.EventsStats(),
  });

  const eventCountsMock = MockApiClient.addMockResponse({
    url: '/organizations/org-slug/events-meta/',
    body: {count: 5},
  });

  const api = new Client();

  it('renders a metric', async () => {
    const {organization, project, router} = initializeOrg();

    render(
      <TriggersChart
        api={api}
        location={router.location}
        organization={organization}
        projects={[project]}
        query="event.type:error"
        timeWindow={1}
        aggregate="count()"
        dataset={Dataset.ERRORS}
        triggers={[]}
        environment={null}
        comparisonType={AlertRuleComparisonType.COUNT}
        resolveThreshold={null}
        thresholdType={AlertRuleThresholdType.BELOW}
        newAlertOrQuery
        handleMEPAlertDataset={() => {}}
      />
    );

    expect(await screen.findByTestId('area-chart')).toBeInTheDocument();

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
  });
});
