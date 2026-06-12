import {
  MetricDetectorFixture,
  SnubaQueryDataSourceFixture,
} from 'sentry-fixture/detectors';
import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {IssueCategory, IssueType} from 'sentry/types/group';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';
import {IssueDetailsContext} from 'sentry/views/issueDetails/context';
import {MetricIssuesSection} from 'sentry/views/issueDetails/metricIssues/metricIssuesSection';
import {getDetectorDetails} from 'sentry/views/issueDetails/sidebar/detectorSection';

describe('MetricIssuesSection', () => {
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

  const detector = MetricDetectorFixture({projectId: project.id});
  const event = EventFixture({
    occurrence: {
      evidenceData: {detectorId: detector.id},
      type: 8001,
    },
  });

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/open-periods/`,
      body: [],
    });
    // Endpoints fired by the correlated issues/transactions tables
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {data: [], meta: {}},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/users/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/members/`,
      body: [],
    });
  });

  function renderSection(
    detectorDetails = getDetectorDetails({event, organization, project})
  ) {
    return render(
      <IssueDetailsContext value={{...baseIssueDetailsContext, detectorDetails}}>
        <MetricIssuesSection
          organization={organization}
          group={group}
          project={project}
        />
      </IssueDetailsContext>,
      {organization}
    );
  }

  it('fetches the detector and renders correlated issues for an error dataset', async () => {
    const mockDetector = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/detectors/${detector.id}/`,
      body: detector,
    });
    const mockIssues = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/`,
      body: [],
    });

    renderSection();

    expect(await screen.findByText('Correlated Issues')).toBeInTheDocument();
    expect(mockDetector).toHaveBeenCalled();
    // The detector's snuba query flows through to the correlated issues request
    expect(mockIssues).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          query: expect.stringContaining('is:unresolved'),
        }),
      })
    );
  });

  it('renders correlated transactions for a transaction dataset detector', async () => {
    const transactionDetector = MetricDetectorFixture({
      projectId: project.id,
      dataSources: [
        SnubaQueryDataSourceFixture({
          queryObj: {
            id: '1',
            status: 1,
            subscription: '1',
            snubaQuery: {
              id: '',
              aggregate: 'count()',
              dataset: Dataset.TRANSACTIONS,
              query: '',
              timeWindow: 60,
              eventTypes: [],
            },
          },
        }),
      ],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/detectors/${detector.id}/`,
      body: transactionDetector,
    });

    renderSection();

    expect(await screen.findByText('Correlated Transactions')).toBeInTheDocument();
  });

  it('renders nothing and never hits the legacy alert-rules endpoint without a metric detector', () => {
    const alertRulesMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/alert-rules/123/`,
      body: {},
    });
    const detectorMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/detectors/${detector.id}/`,
      body: detector,
    });

    renderSection({});

    expect(screen.queryByText('Correlated Issues')).not.toBeInTheDocument();
    expect(screen.queryByText('Correlated Transactions')).not.toBeInTheDocument();
    expect(alertRulesMock).not.toHaveBeenCalled();
    expect(detectorMock).not.toHaveBeenCalled();
  });
});
