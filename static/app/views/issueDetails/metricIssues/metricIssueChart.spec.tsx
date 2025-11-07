import {MetricDetectorFixture} from 'sentry-fixture/detectors';
import {EventFixture} from 'sentry-fixture/event';
import {EventsStatsFixture} from 'sentry-fixture/events';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {IssueCategory, IssueType} from 'sentry/types/group';
import {MetricIssueChart} from 'sentry/views/issueDetails/metricIssues/metricIssueChart';
import {IssueDetailsContext} from 'sentry/views/issueDetails/streamline/context';
import {getDetectorDetails} from 'sentry/views/issueDetails/streamline/sidebar/detectorSection';

describe('MetricIssueChart', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture({organization});
  const group = GroupFixture({
    project,
    issueCategory: IssueCategory.METRIC,
    issueType: IssueType.METRIC_ISSUE,
  });

  const baseIssueDetailsContext = {
    sectionData: {},
    detectorDetails: {},
    isSidebarOpen: true,
    navScrollMargin: 0,
    eventCount: 0,
    dispatch: jest.fn(),
  };

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    // Open periods are used to render incident markers; return empty for simplicity
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/open-periods/`,
      body: [],
    });
  });

  it('renders the metric issue chart', async () => {
    const detector = MetricDetectorFixture({
      projectId: project.id,
    });

    const detectorId = detector.id;
    const event = EventFixture({
      contexts: {metric_alert: {alert_rule_id: detectorId}},
    });
    const detectorDetails = getDetectorDetails({event, organization, project});

    const mockDetector = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/detectors/${detectorId}/`,
      body: detector,
    });
    const mockStats = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      body: EventsStatsFixture(),
    });

    render(
      <IssueDetailsContext value={{...baseIssueDetailsContext, detectorDetails}}>
        <MetricIssueChart group={group} project={project} />
      </IssueDetailsContext>,
      {organization}
    );

    expect(await screen.findByTestId('area-chart')).toBeInTheDocument();
    expect(mockDetector).toHaveBeenCalled();
    expect(mockStats).toHaveBeenCalled();
  });

  it('shows detector load error message when detector request fails', async () => {
    const detectorId = '123';
    const event = EventFixture({
      contexts: {metric_alert: {alert_rule_id: detectorId}},
    });
    const detectorDetails = getDetectorDetails({event, organization, project});

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/detectors/${detectorId}/`,
      statusCode: 500,
      body: {detail: 'Internal Error'},
    });

    render(
      <IssueDetailsContext value={{...baseIssueDetailsContext, detectorDetails}}>
        <MetricIssueChart group={group} project={project} />
      </IssueDetailsContext>,
      {organization}
    );

    expect(await screen.findByText(/Error loading metric monitor:/i)).toBeInTheDocument();
    expect(screen.queryByTestId('area-chart')).not.toBeInTheDocument();
  });
});
