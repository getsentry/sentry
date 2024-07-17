import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  render,
  screen,
  waitFor,
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';

import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {PagePerformanceTable} from 'sentry/views/insights/browser/webVitals/components/tables/pagePerformanceTable';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/usePageFilters');

describe('PagePerformanceTable', function () {
  const organization = OrganizationFixture();

  let eventsMock;

  beforeEach(function () {
    jest.mocked(useLocation).mockReturnValue({
      pathname: '',
      search: '',
      query: {},
      hash: '',
      state: undefined,
      action: 'PUSH',
      key: '',
    });
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
    eventsMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {
        data: [
          {
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
      },
    });
  });

  afterEach(function () {
    jest.clearAllMocks();
  });

  it('escapes user input search filter', async () => {
    jest.mocked(useLocation).mockReturnValue({
      pathname: '',
      search: '',
      query: {query: '/issues/*'},
      hash: '',
      state: undefined,
      action: 'PUSH',
      key: '',
    });
    render(<PagePerformanceTable />, {organization});
    await waitFor(() => {
      expect(eventsMock).toHaveBeenCalledTimes(2);
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
    render(<PagePerformanceTable />, {organization});

    await waitForElementToBeRemoved(() => screen.queryAllByTestId('loading-indicator'));

    expect(screen.getByRole('table', {name: 'Pages'})).toBeInTheDocument();

    expect(screen.getByRole('columnheader', {name: 'Pages'})).toBeInTheDocument();
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
      'overview/?transaction=%2Finsights%2Fbrowser%2F'
    );
    expect(screen.getByRole('cell', {name: '492'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: '700ms'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: '563ms'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: '144ms'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: '0.18'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: '783ms'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: 'Meh 85'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: '18.25'})).toBeInTheDocument();
  });
});
