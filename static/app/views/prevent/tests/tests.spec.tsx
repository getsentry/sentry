import {GitHubIntegrationProviderFixture} from 'sentry-fixture/githubIntegrationProvider';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import PreventQueryParamsProvider from 'sentry/components/prevent/container/preventParamsProvider';
import localStorageWrapper from 'sentry/utils/localStorage';
import {getRegionDataFromOrganization} from 'sentry/utils/regions';
import TestsPage from 'sentry/views/prevent/tests/tests';

jest.mock('sentry/utils/regions', () => ({
  getRegionDataFromOrganization: jest.fn(),
}));

const mockGetRegionData = jest.mocked(getRegionDataFromOrganization);

// TODO: Make these fixtures
const mockTestResultsData = [
  {
    name: 'tests.symbolicator.test_unreal_full.SymbolicatorUnrealIntegrationTest::test_unreal_crash_with_attachments',
    avgDuration: 4,
    flakeRate: 0.4,
    lastRun: '2025-04-17T22:26:19.486793+00:00',
    totalFailCount: 1,
    totalFlakyFailCount: 2,
    totalPassCount: 0,
    totalSkipCount: 3,
    updatedAt: '2025-04-17T22:26:19.486793+00:00',
  },
];

// TODO: Make these fixtures
const mockTestResultAggregates = [
  {
    slowestTestsDuration: 6234,
    slowestTestsDurationPercentChange: 0.4,
    totalDuration: 28787,
    totalDurationPercentChange: 0.6,
    totalFails: 1,
    totalFailsPercentChange: 0.42,
    totalSkips: 2,
    totalSkipsPercentChange: -0.23,
    totalSlowTests: 100,
    totalSlowTestsPercentChange: 0,
    flakeCount: 3,
    flakeCountPercentChange: null,
    flakeRate: 4.9326690672322796e-5,
    flakeRatePercentChange: null,
  },
];

const mockRepositories = [
  {
    name: 'test-repo-one',
    updatedAt: '2025-05-22T16:21:18.763951+00:00',
    latestCommitAt: '2025-05-21T16:21:18.763951+00:00',
    defaultBranch: 'branch-one',
  },
  {
    name: 'test-repo-two',
    updatedAt: '2025-05-22T16:21:18.763951+00:00',
    latestCommitAt: '2025-05-21T16:21:18.763951+00:00',
    defaultBranch: 'branch-two',
  },
];

const mockBranches = [
  {
    name: 'main',
  },
  {
    name: 'another branch',
  },
];

const mockIntegrations = [
  {name: 'integration-1', id: '1', status: 'active'},
  {name: 'integration-2', id: '2', status: 'active'},
];

const mockRepoData = {
  testAnalyticsEnabled: true,
  uploadToken: 'test-token',
};

const mockApiCall = () => {
  MockApiClient.addMockResponse({
    url: `/organizations/org-slug/prevent/owner/123/repository/some-repository/test-results/`,
    method: 'GET',
    body: {
      results: mockTestResultsData,
      pageInfo: {
        endCursor: 'sdfgadghsefhaasdfnkjasdf',
        hasNextPage: true,
      },
      totalCount: 1,
    },
  });

  MockApiClient.addMockResponse({
    url: `/organizations/org-slug/prevent/owner/123/repository/some-repository/test-results-aggregates/`,
    method: 'GET',
    body: {
      results: mockTestResultAggregates,
    },
  });

  MockApiClient.addMockResponse({
    url: `/organizations/org-slug/prevent/owner/123/repositories/`,
    method: 'GET',
    body: {
      results: mockRepositories,
    },
  });
  MockApiClient.addMockResponse({
    url: `/organizations/org-slug/prevent/owner/123/repository/some-repository/branches/`,
    method: 'GET',
    body: {
      defaultBranch: 'main',
      results: mockBranches,
    },
  });
  MockApiClient.addMockResponse({
    url: `/organizations/org-slug/integrations/`,
    method: 'GET',
    body: mockIntegrations,
  });
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/prevent/owner/123/repositories/sync/',
    method: 'GET',
    body: {
      isSyncing: false,
    },
  });
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/prevent/owner/123/repository/some-repository/',
    method: 'GET',
    body: mockRepoData,
  });
  MockApiClient.addMockResponse({
    url: `/organizations/org-slug/config/integrations/`,
    method: 'GET',
    body: {
      providers: [GitHubIntegrationProviderFixture()],
    },
  });
};

describe('CoveragePageWrapper', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    localStorageWrapper.clear();
    localStorageWrapper.setItem(
      'prevent-selection:org-slug',
      JSON.stringify({
        'test-integration': {
          integratedOrgId: '123',
        },
      })
    );
    mockApiCall();
  });

  describe('when the wrapper is used', () => {
    it('renders the passed children', async () => {
      mockGetRegionData.mockReturnValue({
        name: 'us',
        displayName: 'United States',
        url: 'https://sentry.io',
      });

      render(
        <PreventQueryParamsProvider>
          <TestsPage />
        </PreventQueryParamsProvider>,
        {
          initialRouterConfig: {
            location: {
              pathname: '/prevent/tests',
              query: {
                preventPeriod: '7d',
                integratedOrgName: 'test-integration',
                repository: 'some-repository',
                branch: 'some-branch',
              },
            },
          },
        }
      );

      await waitFor(() => {
        expect(
          screen.getByTestId('page-filter-integrated-org-selector')
        ).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument();
      });

      expect(await screen.findByRole('button', {name: 'Previous'})).toBeInTheDocument();
      expect(await screen.findByRole('button', {name: 'Next'})).toBeInTheDocument();
    });
  });
  describe('when the organization is not in the US region', () => {
    it('renders the pre-onboarding page', () => {
      MockApiClient.addMockResponse({
        url: `/organizations/org-slug/config/integrations/`,
        method: 'GET',
        body: {
          providers: [],
        },
      });

      mockGetRegionData.mockReturnValue({
        name: 'eu',
        displayName: 'European Union (EU)',
        url: 'https://eu.sentry.io',
      });

      render(
        <PreventQueryParamsProvider>
          <TestsPage />
        </PreventQueryParamsProvider>,
        {
          initialRouterConfig: {
            location: {
              pathname: '/prevent/tests',
              query: {
                preventPeriod: '7d',
                integratedOrgName: 'test-integration',
                repository: 'some-repository',
                branch: 'some-branch',
              },
            },
          },
          organization: OrganizationFixture({features: ['test-analytics']}),
        }
      );

      expect(
        screen.getByText('Keep Test Problems From Slowing You Down')
      ).toBeInTheDocument();
    });
  });
});
