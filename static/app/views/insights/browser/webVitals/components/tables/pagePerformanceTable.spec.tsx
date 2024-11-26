import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {
  render,
  screen,
  waitFor,
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';

import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {PagePerformanceTable} from 'sentry/views/insights/browser/webVitals/components/tables/pagePerformanceTable';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/useProjects');
jest.mock('sentry/utils/usePageFilters');

describe('PagePerformanceTable', function () {
  const organization = OrganizationFixture();
  const router = RouterFixture();

  let eventsMock: jest.Mock;

  beforeEach(function () {
    jest.mocked(useLocation).mockReturnValue(router.location);

    jest.mocked(usePageFilters).mockReturnValue({
      isReady: true,
      desyncedFilters: new Set(),
      pinnedFilters: new Set(),
      shouldPersist: true,
      selection: {
        datetime: {
          period: '10d',
          start: null,
          end: null,
          utc: false,
        },
        environments: [],
        projects: [],
      },
    });

    jest.mocked(useProjects).mockReturnValue({
      projects: [
        ProjectFixture({
          id: '11276',
          name: 'frontend',
          slug: 'frontend',
          platform: 'python',
        }),
      ],
      onSearch: jest.fn(),
      reloadProjects: jest.fn(),
      placeholders: [],
      fetching: false,
      hasMore: null,
      fetchError: null,
      initiallyLoaded: false,
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      body: [ProjectFixture({id: '11276', name: 'frontend', slug: 'frontend'})],
    });

    eventsMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {
        data: [
          {
            'project.id': 11276,
            project: 'frontend',
            transaction: '/insights/browser/',
            'count()': 492,
            'count_scores(measurements.score.inp)': 985,
            'count_scores(measurements.score.total)': 985,
            'avg(measurements.score.total)': 0.847767385770207,
            'total_opportunity_score()': 6.956683571915815e-5,
            'opportunity_score(measurements.score.total)': 179.76662400002692,
            'p75(measurements.inp)': 144.0,
            'p75(measurements.ttfb)': 783.125,
            'p75(measurements.lcp)': 700.2999782562256,
            'p75(measurements.cls)': 0.17772871140057198,
            'p75(measurements.fcp)': 563.2752180099487,
            'count_scores(measurements.score.cls)': 311,
            'count_scores(measurements.score.fcp)': 414,
            'count_scores(measurements.score.ttfb)': 477,
            'count_scores(measurements.score.lcp)': 391,
          },
        ],
        meta: {
          fields: {
            transaction: 'string',
            'project.id': 'number',
            project: 'string',
          },
        },
      },
    });
  });

  afterEach(function () {
    jest.clearAllMocks();
  });

  it('escapes user input search filter', async () => {
    jest.mocked(useLocation).mockReturnValue({
      ...router.location,
      query: {query: '/issues/*'},
    });
    render(<PagePerformanceTable />, {router, organization});
    await waitFor(() => {
      expect(eventsMock).toHaveBeenCalledTimes(1);
      expect(eventsMock).toHaveBeenLastCalledWith(
        '/organizations/org-slug/events/',
        expect.objectContaining({
          query: expect.objectContaining({
            query: expect.stringContaining('transaction:"*/issues/\\**"'),
          }),
        })
      );
    });
  });

  it('renders a list of pages', async function () {
    render(<PagePerformanceTable />, {router, organization});

    await waitForElementToBeRemoved(() => screen.queryAllByTestId('loading-indicator'));

    expect(screen.getByRole('table', {name: 'Pages'})).toBeInTheDocument();

    expect(screen.getByRole('columnheader', {name: 'Pages'})).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'Project'})).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'Pageloads'})).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'LCP'})).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'LCP'})).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'INP'})).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'CLS'})).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'TTFB'})).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'Perf Score'})).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'Opportunity'})).toBeInTheDocument();

    expect(screen.getByRole('cell', {name: '/insights/browser/'})).toBeInTheDocument();
    expect(screen.getByRole('link', {name: '/insights/browser/'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/insights/frontend/pageloads/overview/?project=11276&transaction=%2Finsights%2Fbrowser%2F'
    );

    expect(screen.getByRole('cell', {name: 'View Project Details'})).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'View Project Details'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/projects/frontend/?project=11276'
    );
    expect(screen.getByRole('cell', {name: '492'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: '700ms'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: '563ms'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: '144ms'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: '0.18'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: '783ms'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: 'Meh 85'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: '0.01'})).toBeInTheDocument();
  });
});
