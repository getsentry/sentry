import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFilterStateFixture} from 'sentry-fixture/pageFilters';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, waitForElementToBeRemoved} from 'sentry-test/reactTestingLibrary';

import usePageFilters from 'sentry/components/pageFilters/usePageFilters';
import ProjectsStore from 'sentry/stores/projectsStore';
import {useLocation} from 'sentry/utils/useLocation';
import {PageOverviewWebVitalsDetailPanel} from 'sentry/views/insights/browser/webVitals/components/pageOverviewWebVitalsDetailPanel';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/components/pageFilters/usePageFilters');

describe('PageOverviewWebVitalsDetailPanel', () => {
  const organization = OrganizationFixture({
    features: ['performance-web-vitals-seer-suggestions'],
  });
  const project = ProjectFixture();
  const location = LocationFixture({
    query: {
      project: project.id,
      transaction: 'test-transaction',
    },
  });

  beforeEach(() => {
    jest.mocked(useLocation).mockReturnValue(location);
    jest.mocked(usePageFilters).mockReturnValue({
      ...PageFilterStateFixture(),
      selection: {
        ...PageFilterStateFixture().selection,
        projects: [2],
      },
    });
    ProjectsStore.loadInitialData([project]);

    // Mock API responses
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {
        data: [
          {
            'performance_score(measurements.score.lcp)': 0.8,
            'performance_score(measurements.score.fcp)': 0.9,
            'performance_score(measurements.score.cls)': 0.7,
            'performance_score(measurements.score.inp)': 0.85,
            'performance_score(measurements.score.ttfb)': 0.75,
            'performance_score(measurements.score.total)': 0.8,
            'count_scores(measurements.score.lcp)': 100,
            'count_scores(measurements.score.fcp)': 100,
            'count_scores(measurements.score.cls)': 100,
            'count_scores(measurements.score.inp)': 100,
            'count_scores(measurements.score.ttfb)': 100,
            trace: 'trace-123',
          },
        ],
      },
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-timeseries/`,
      body: {
        timeSeries: [],
      },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly with web vital', async () => {
    render(<PageOverviewWebVitalsDetailPanel webVital="lcp" />, {
      organization,
    });

    await waitForElementToBeRemoved(() => screen.queryAllByTestId('loading-indicator'));

    expect(screen.getAllByText('Largest Contentful Paint (P75)')).toHaveLength(2);
    expect(screen.getByText('Transaction')).toBeInTheDocument();
    expect(screen.getByText('Profile')).toBeInTheDocument();
    expect(screen.getByText('Replay')).toBeInTheDocument();
    expect(screen.getByText('lcp')).toBeInTheDocument();
    expect(screen.getByText('lcp Score')).toBeInTheDocument();
  });
});
