import {EventFixture} from 'sentry-fixture/event';
import {EventsStatsFixture} from 'sentry-fixture/events';
import {GroupFixture} from 'sentry-fixture/group';
import {IncidentFixture} from 'sentry-fixture/incident';
import {MetricRuleFixture} from 'sentry-fixture/metricRule';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {SessionsFieldFixture} from 'sentry-fixture/sessions';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {IssueCategory, IssueType} from 'sentry/types/group';
import {Dataset, SessionsAggregate} from 'sentry/views/alerts/rules/metric/types';
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
  let mockIncidents: jest.Mock;

  beforeEach(() => {
    MockApiClient.clearMockResponses();
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
    const mockRule = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/alert-rules/${rule.id}/`,
      body: rule,
      query: {
        expand: 'latestIncident',
      },
    });
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
    const mockRule = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/alert-rules/${rule.id}/`,
      body: rule,
      query: {
        expand: 'latestIncident',
      },
    });
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

  it('renders the metric issue chart with session data', async function () {
    const mockRule = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/alert-rules/${rule.id}/`,
      body: {
        ...rule,
        dataset: Dataset.SESSIONS,
        aggregate: SessionsAggregate.CRASH_FREE_SESSIONS,
        query: 'event.type:error',
      },
      query: {
        expand: 'latestIncident',
      },
    });

    const mockSessionStats = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/sessions/`,
      body: SessionsFieldFixture('sum(session)'),
    });

    render(<MetricIssueChart group={group} project={project} />, {organization});
    await screen.findByTestId('metric-issue-chart-loading');
    expect(await screen.findByRole('figure')).toBeInTheDocument();
    expect(mockRule).toHaveBeenCalled();
    expect(mockIncidents).toHaveBeenCalled();
    expect(mockSessionStats).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          project: [parseInt(project.id, 10)],
          field: 'sum(session)',
          groupBy: ['session.status'],
        }),
      })
    );
  });
});
