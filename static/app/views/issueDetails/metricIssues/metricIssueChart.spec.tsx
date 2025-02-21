import {EventFixture} from 'sentry-fixture/event';
import {EventsStatsFixture} from 'sentry-fixture/events';
import {GroupFixture} from 'sentry-fixture/group';
import {IncidentFixture} from 'sentry-fixture/incident';
import {MetricRuleFixture} from 'sentry-fixture/metricRule';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {IssueCategory, IssueType} from 'sentry/types/group';
import {MetricIssueChart} from 'sentry/views/issueDetails/metricIssues/metricIssueChart';

describe('MetricIssueChart', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture({organization});
  const rule = MetricRuleFixture({projects: [project.slug]});
  const incident = IncidentFixture({alertRule: rule});
  const group = GroupFixture({
    project,
    issueCategory: IssueCategory.METRIC_ALERT,
    issueType: IssueType.METRIC_ISSUE_POC,
  });
  const event = EventFixture({
    contexts: {
      metric_alert: {
        alert_rule_id: rule.id,
      },
    },
  });

  let mockRule: jest.Mock;
  let mockIncidents: jest.Mock;

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    mockRule = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/alert-rules/${rule.id}/`,
      body: rule,
      query: {
        expand: 'latestIncident',
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/events/recommended/`,
      body: event,
    });
    mockIncidents = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/incidents/`,
      body: [incident],
    });
  });

  it('renders the metric issue chart', async function () {
    const mockStats = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      body: EventsStatsFixture(),
    });
    render(<MetricIssueChart group={group} project={project} />, {organization});
    await screen.findByTestId('metric-issue-chart-loading');
    expect(await screen.findByRole('figure')).toBeInTheDocument();
    expect(mockRule).toHaveBeenCalled();
    expect(mockIncidents).toHaveBeenCalled();
    expect(mockStats).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          project: [parseInt(project.id, 10)],
          query: 'event.type:error',
          referrer: 'metric-issue-chart',
          yAxis: rule.aggregate,
        }),
      })
    );
  });

  it('displays error messages from bad queries', async function () {
    const mockStats = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      body: {detail: 'timeout'},
      statusCode: 500,
    });
    render(<MetricIssueChart group={group} project={project} />, {organization});
    await screen.findByTestId('metric-issue-chart-error');
    expect(mockRule).toHaveBeenCalled();
    expect(mockIncidents).toHaveBeenCalled();
    expect(mockStats).toHaveBeenCalled();
    expect(screen.getByText('Unable to load the metric history')).toBeInTheDocument();
    expect(screen.queryByRole('figure')).not.toBeInTheDocument();
  });
});
