import {MetricDetectorFixture} from 'sentry-fixture/detectors';
import {EventFixture} from 'sentry-fixture/event';
import {EventsStatsFixture} from 'sentry-fixture/events';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {parseStatsPeriod} from 'sentry/components/pageFilters/parse';
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

  const detector = MetricDetectorFixture({
    projectId: project.id,
  });
  const event = EventFixture({
    occurrence: {
      evidenceData: {
        detectorId: detector.id,
      },
      type: 8001,
    },
  });

  it('renders the metric issue chart', async () => {
    const detectorDetails = getDetectorDetails({event, organization, project});

    const mockDetector = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/detectors/${detector.id}/`,
      body: detector,
    });
    const mockStats = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      body: EventsStatsFixture(),
    });

    render(
      <IssueDetailsContext value={{...baseIssueDetailsContext, detectorDetails}}>
        <MetricIssueChart group={group} event={event} />
      </IssueDetailsContext>,
      {organization}
    );

    expect(await screen.findByTestId('area-chart')).toBeInTheDocument();
    expect(mockDetector).toHaveBeenCalled();
    expect(mockStats).toHaveBeenCalled();
  });

  it('limits metric issue chart range to 10k points and shows a warning', async () => {
    const detectorDetails = getDetectorDetails({event, organization, project});

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/detectors/${detector.id}/`,
      body: detector,
    });
    const mockStats = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      body: EventsStatsFixture(),
    });

    render(
      <IssueDetailsContext value={{...baseIssueDetailsContext, detectorDetails}}>
        <MetricIssueChart group={group} event={event} />
      </IssueDetailsContext>,
      {
        organization,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/issues/group-id/',
            query: {statsPeriod: '30d'},
          },
        },
      }
    );

    expect(await screen.findByTestId('area-chart')).toBeInTheDocument();
    expect(
      screen.getByText(
        /Showing only the most recent 10,000 data points\. Narrow the time range to view older data\./
      )
    ).toBeInTheDocument();
    expect(mockStats).toHaveBeenCalled();
    const [, statsRequest] = mockStats.mock.calls[0] ?? [];
    const clampedStatsPeriod = statsRequest?.query?.statsPeriod;

    expect(clampedStatsPeriod).not.toBe('30d');
    const parsedStatsPeriod = parseStatsPeriod(clampedStatsPeriod);
    expect(parsedStatsPeriod).toBeDefined();
    if (!parsedStatsPeriod) {
      throw new Error('Expected a clamped stats period');
    }

    const durationMinutesByPeriodLength = {
      s: 1 / 60,
      m: 1,
      h: 60,
      d: 24 * 60,
      w: 7 * 24 * 60,
    };
    const durationMinutes =
      Number(parsedStatsPeriod.period) *
      durationMinutesByPeriodLength[parsedStatsPeriod.periodLength];

    expect(durationMinutes).toBeLessThanOrEqual(10_000);
  });

  it('shows detector load error message when detector request fails', async () => {
    const detectorDetails = getDetectorDetails({event, organization, project});

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/detectors/${detector.id}/`,
      statusCode: 404,
    });

    render(
      <IssueDetailsContext value={{...baseIssueDetailsContext, detectorDetails}}>
        <MetricIssueChart group={group} event={event} />
      </IssueDetailsContext>,
      {organization}
    );

    expect(
      await screen.findByText(
        /The metric monitor which created this issue no longer exists./i
      )
    ).toBeInTheDocument();
    expect(screen.queryByTestId('area-chart')).not.toBeInTheDocument();
  });
});
