import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import type {PageFilters} from 'sentry/types/core';
import {PageOverviewSidebar} from 'sentry/views/insights/browser/webVitals/components/pageOverviewSidebar';

const TRANSACTION_NAME = 'transaction';

describe('PageOverviewSidebar', () => {
  const organization = OrganizationFixture({
    features: ['performance-web-vitals-seer-suggestions'],
  });
  let userIssueMock: jest.Mock;
  let eventsMock: jest.Mock;

  beforeEach(() => {
    // Initialize the page filters store instead of mocking hooks
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
    PageFiltersStore.onInitializeUrlState(pageFilters, new Set());
    const project = ProjectFixture({id: '1', slug: 'project-slug'});
    ProjectsStore.loadInitialData([project]);

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      body: {
        data: [],
      },
    });

    eventsMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {
        data: [{trace: '123'}],
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

    userIssueMock = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/user-issue/`,
      body: {event_id: '123'},
      method: 'POST',
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render', () => {
    render(<PageOverviewSidebar transaction={TRANSACTION_NAME} />, {organization});

    expect(screen.getByText('Performance Score')).toBeInTheDocument();
    expect(screen.getByText('Page Loads')).toBeInTheDocument();
    expect(screen.getByText('Interactions')).toBeInTheDocument();
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

  it('should create issues when run seer analysis button is clicked', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/`,
      body: [],
    });
    render(
      <PageOverviewSidebar
        transaction={TRANSACTION_NAME}
        projectScore={{lcpScore: 80}}
      />,
      {organization}
    );
    const runSeerAnalysisButton = await screen.findByText('Run Seer Analysis');
    expect(runSeerAnalysisButton).toBeInTheDocument();
    await userEvent.click(runSeerAnalysisButton);
    expect(userIssueMock).toHaveBeenCalledWith(
      '/projects/org-slug/project-slug/user-issue/',
      expect.objectContaining({
        method: 'POST',
        data: expect.objectContaining({
          issueType: 'web_vitals',
          vital: 'lcp',
          score: 80,
          transaction: TRANSACTION_NAME,
        }),
      })
    );
    expect(screen.queryByText('Run Seer Analysis')).not.toBeInTheDocument();
  });

  it('should create multiple issues with trace ids when run seer analysis button is clicked', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/`,
      body: [],
    });
    render(
      <PageOverviewSidebar
        transaction={TRANSACTION_NAME}
        projectScore={{
          lcpScore: 80,
          clsScore: 80,
          fcpScore: 80,
          ttfbScore: 100,
          inpScore: 80,
        }}
        projectData={[
          {
            'p75(measurements.lcp)': 2500,
            'p75(measurements.cls)': 0.1,
            'p75(measurements.fcp)': 1800,
            'p75(measurements.ttfb)': 600,
            'p75(measurements.inp)': 200,
          },
        ]}
      />,
      {organization}
    );

    const runSeerAnalysisButton = await screen.findByText('Run Seer Analysis');
    expect(runSeerAnalysisButton).toBeInTheDocument();
    expect(eventsMock).toHaveBeenCalledTimes(5);
    await userEvent.click(runSeerAnalysisButton);
    ['lcp', 'cls', 'fcp', 'inp'].forEach(vital => {
      expect(userIssueMock).toHaveBeenCalledWith(
        '/projects/org-slug/project-slug/user-issue/',
        expect.objectContaining({
          method: 'POST',
          data: expect.objectContaining({
            issueType: 'web_vitals',
            vital,
            score: 80,
            transaction: TRANSACTION_NAME,
            traceId: '123',
          }),
        })
      );
    });
    // TTFB has a score over 90, so it should not be created as an issue
    expect(userIssueMock).not.toHaveBeenCalledWith(
      '/projects/org-slug/project-slug/user-issue/',
      expect.objectContaining({
        method: 'POST',
        data: expect.objectContaining({
          issueType: 'web_vitals',
          vital: 'ttfb',
          score: 100,
          transaction: TRANSACTION_NAME,
          traceId: '123',
        }),
      })
    );
    expect(screen.queryByText('Run Seer Analysis')).not.toBeInTheDocument();
  });
});
