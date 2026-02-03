import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import type {PageFilters} from 'sentry/types/core';
import {PageOverviewSidebar} from 'sentry/views/insights/browser/webVitals/components/pageOverviewSidebar';

const TRANSACTION_NAME = 'transaction';

describe('PageOverviewSidebar', () => {
  const organization = OrganizationFixture({
    features: ['performance-web-vitals-seer-suggestions', 'gen-ai-features'],
  });
  let seerSetupCheckMock: jest.Mock;
  let seerPreferencesMock: jest.Mock;

  beforeEach(() => {
    const pageFilters: PageFilters = {
      projects: [1],
      environments: [],
      datetime: {
        period: '14d',
        start: null,
        end: null,
        utc: null,
      },
    };
    PageFiltersStore.onInitializeUrlState(pageFilters);
    const project = ProjectFixture({id: '1', slug: 'project-slug'});
    ProjectsStore.loadInitialData([project]);

    seerSetupCheckMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/seer/setup-check/',
      method: 'GET',
      body: {},
    });

    seerPreferencesMock = MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/seer/preferences/',
      method: 'GET',
      body: {},
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-timeseries/`,
      body: {
        timeSeries: [],
      },
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/`,
      body: [
        {
          id: '123',
          shortId: '123',
          title: 'LCP score needs improvement',
        },
      ],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/123/autofix/`,
      body: {
        autofix: {
          steps: [
            {
              causes: [
                {
                  description:
                    'Unoptimized screenshot images are directly embedded, causing large downloads and delaying Largest Contentful Paint on issue detail pages.',
                },
              ],
              type: 'root_cause_analysis',
            },
          ],
        },
      },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const mockSeerChecks = () => {
    seerSetupCheckMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/seer/setup-check/',
      method: 'GET',
      body: {
        setupAcknowledgement: {
          orgHasAcknowledged: true,
          userHasAcknowledged: true,
        },
        billing: {
          hasAutofixQuota: true,
          hasScannerQuota: true,
        },
      },
    });
  };

  const mockSeerPreferences = () => {
    seerPreferencesMock = MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/seer/preferences/',
      method: 'GET',
      body: {
        preference: {
          organization_id: 1,
          project_id: 1,
          repositories: [
            {
              integration_id: null,
              provider: 'github',
              owner: 'getsentry',
              name: 'getsentry',
              external_id: '3060925',
              branch_name: '',
              branch_overrides: [],
              instructions: '',
              base_commit_sha: null,
              provider_raw: null,
            },
          ],
          automated_run_stopping_point: 'code_changes',
        },
        code_mapping_repos: [
          {
            integration_id: null,
            provider: 'integrations:github',
            owner: 'getsentry',
            name: 'getsentry',
            external_id: '3060925',
            branch_name: null,
            branch_overrides: [],
            instructions: null,
            base_commit_sha: null,
            provider_raw: null,
          },
        ],
      },
    });
  };

  it('should render', () => {
    render(<PageOverviewSidebar transaction={TRANSACTION_NAME} />, {organization});

    expect(screen.getByText('Performance Score')).toBeInTheDocument();
    expect(screen.getByText('Page Loads')).toBeInTheDocument();
    expect(screen.getByText('Interactions')).toBeInTheDocument();
  });

  it('should not display seer suggestions if the org does not have ai features and consent', async () => {
    mockSeerPreferences();
    render(<PageOverviewSidebar transaction={TRANSACTION_NAME} />, {organization});

    await waitFor(() => {
      expect(seerPreferencesMock).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(seerSetupCheckMock).toHaveBeenCalled();
    });
    expect(screen.queryByText('Seer Suggestions')).not.toBeInTheDocument();
  });

  it('should not display seer suggestions if the project does not have a repository setup', async () => {
    mockSeerChecks();
    render(<PageOverviewSidebar transaction={TRANSACTION_NAME} />, {organization});

    await waitFor(() => {
      expect(seerPreferencesMock).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(seerSetupCheckMock).toHaveBeenCalled();
    });
    expect(screen.queryByText('Seer Suggestions')).not.toBeInTheDocument();
  });

  describe('with seer enabled', () => {
    beforeEach(() => {
      mockSeerChecks();
      mockSeerPreferences();
    });

    it('should render seer suggestions for LCP', async () => {
      render(
        <PageOverviewSidebar
          transaction={TRANSACTION_NAME}
          projectScore={{lcpScore: 80}}
        />,
        {organization}
      );

      expect(await screen.findByText('Seer Suggestions')).toBeInTheDocument();
      expect(await screen.findByText('LCP score needs improvement')).toBeInTheDocument();
      expect(
        await screen.findByText(
          'Unoptimized screenshot images are directly embedded, causing large downloads and delaying Largest Contentful Paint on issue detail pages.'
        )
      ).toBeInTheDocument();
      expect(screen.getByText('View Suggestion')).toBeInTheDocument();
    });
  });
});
