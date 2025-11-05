import type {Query} from 'history';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {ThemeFixture} from 'sentry-fixture/theme';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  act,
  render,
  screen,
  userEvent,
  waitFor,
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import type {Project} from 'sentry/types/project';
import TransactionSummaryLayout from 'sentry/views/performance/transactionSummary/layout';
import TransactionSummaryTab from 'sentry/views/performance/transactionSummary/tabs';
import TransactionVitals from 'sentry/views/performance/transactionSummary/transactionVitals';
import {
  makeVitalGroups,
  makeZoomKeys,
} from 'sentry/views/performance/transactionSummary/transactionVitals/constants';

const theme = ThemeFixture();

interface HistogramData {
  count: number;
  histogram: number;
}

function initialize({
  project,
  features,
  transaction,
  query,
}: {
  features?: string[];
  project?: Project;
  query?: Query;
  transaction?: string;
} = {}) {
  features = features || ['performance-view'];
  project = project || ProjectFixture();
  query = query || {};
  const data = initializeOrg({
    organization: OrganizationFixture({
      features,
    }),
    router: {
      location: {
        query: {
          transaction: transaction || '/',
          project: project?.id,
          ...query,
        },
      },
    },
  });
  act(() => ProjectsStore.loadInitialData(data.projects));
  return data;
}

const renderWithLayout = (data: ReturnType<typeof initialize>) => {
  return render(<TransactionSummaryLayout />, {
    organization: data.organization,
    initialRouterConfig: {
      location: {
        pathname: '/performance/summary/vitals/',
        query: data.routerProps.location.query,
      },
      route: '/performance/summary/',
      children: [
        {
          path: 'vitals',
          handle: {tab: TransactionSummaryTab.WEB_VITALS},
          element: <TransactionVitals />,
        },
      ],
    },
  });
};

/**
 * These values are what we expect to see on the page based on the
 * mocked api responses below.
 */
const vitals = [
  {
    slug: 'fp',
    heading: 'First Paint (FP)',
    baseline: '4.57s',
  },
  {
    slug: 'fcp',
    heading: 'First Contentful Paint (FCP)',
    baseline: '1.46s',
  },
  {
    slug: 'lcp',
    heading: 'Largest Contentful Paint (LCP)',
    baseline: '1.34s',
  },
  {
    slug: 'fid',
    heading: 'First Input Delay (FID)',
    baseline: '987.00ms',
  },
  {
    slug: 'cls',
    heading: 'Cumulative Layout Shift (CLS)',
    baseline: '0.02',
  },
];

describe('Performance > Web Vitals', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(jest.fn());

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-has-measurements/',
      body: {measurements: true},
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/project-transaction-threshold-override/',
      method: 'GET',
      body: {
        threshold: '800',
        metric: 'lcp',
      },
    });

    // Mock baseline measurements
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-vitals/',
      body: {
        'measurements.fp': {poor: 1, meh: 2, good: 3, total: 6, p75: 4567},
        'measurements.fcp': {poor: 1, meh: 2, good: 3, total: 6, p75: 1456},
        'measurements.lcp': {poor: 1, meh: 2, good: 3, total: 6, p75: 1342},
        'measurements.fid': {poor: 1, meh: 2, good: 3, total: 6, p75: 987},
        'measurements.cls': {poor: 1, meh: 2, good: 3, total: 6, p75: 0.02},
      },
    });

    const histogramData: Record<string, HistogramData[]> = {};
    const webVitals = makeVitalGroups(theme).reduce<string[]>(
      (vs, group) => vs.concat(group.vitals),
      []
    );

    for (const measurement of webVitals) {
      const data: HistogramData[] = [];
      for (let i = 0; i < 100; i++) {
        data.push({
          histogram: i,
          count: i,
        });
      }
      histogramData[`measurements.${measurement}`] = data;
    }

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-histogram/',
      body: histogramData,
    });

    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/key-transactions-list/`,
      body: [],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/prompts-activity/',
      body: {},
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/sdk-updates/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/replay-count/',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      body: [],
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('render no access without feature', () => {
    const data = initialize({
      features: [],
    });

    renderWithLayout(data);

    expect(screen.getByText("You don't have access to this feature")).toBeInTheDocument();
  });

  it('renders the basic UI components', () => {
    const data = initialize({
      transaction: '/organizations/:orgId/',
    });

    renderWithLayout(data);

    expect(screen.getByText('/organizations/:orgId/')).toBeInTheDocument();

    ['navigation', 'main'].forEach(role => {
      expect(screen.getByRole(role)).toBeInTheDocument();
    });
  });

  it('renders the correct bread crumbs', () => {
    const data = initialize();

    renderWithLayout(data);

    expect(screen.getByRole('navigation')).toHaveTextContent(
      'InsightsTransaction Summary'
    );
  });

  describe('renders all vitals cards correctly', () => {
    const data = initialize();

    it.each(vitals)('Renders %s', async vital => {
      renderWithLayout(data);
      expect(await screen.findByText(vital.heading)).toBeInTheDocument();
      expect(await screen.findByText(vital.baseline)).toBeInTheDocument();
    });
  });

  describe('reset view', () => {
    it('disables button on default view', () => {
      const data = initialize();

      renderWithLayout(data);

      expect(screen.getByRole('button', {name: 'Reset View'})).toBeDisabled();
    });

    it('enables button on left zoom', () => {
      const data = initialize({
        query: {
          lcpStart: '20',
        },
      });

      renderWithLayout(data);

      expect(screen.getByRole('button', {name: 'Reset View'})).toBeEnabled();
    });

    it('enables button on right zoom', () => {
      const data = initialize({
        query: {
          fpEnd: '20',
        },
      });

      renderWithLayout(data);

      expect(screen.getByRole('button', {name: 'Reset View'})).toBeEnabled();
    });

    it('enables button on left and right zoom', () => {
      const data = initialize({
        query: {
          fcpStart: '20',
          fcpEnd: '20',
        },
      });

      renderWithLayout(data);

      expect(screen.getByRole('button', {name: 'Reset View'})).toBeEnabled();
    });

    it('resets view properly', async () => {
      const data = initialize({
        query: {
          fidStart: '20',
          lcpEnd: '20',
        },
      });

      renderWithLayout(data);

      await userEvent.click(screen.getByRole('button', {name: 'Reset View'}));

      expect(data.router.location.query).toMatchObject({
        fidStart: '20',
        lcpEnd: '20',
      });

      await waitFor(() => {
        expect(data.router.location.query).toMatchObject(
          expect.not.objectContaining(
            makeZoomKeys().reduce(
              (obj, key) => {
                obj[key] = expect.anything();
                return obj;
              },
              {} as Record<string, unknown>
            )
          )
        );
      });
    });

    it('renders an info alert when missing web vitals data', async () => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events-vitals/',
        body: {
          'measurements.fp': {poor: 1, meh: 2, good: 3, total: 6, p75: 4567},
          'measurements.fcp': {poor: 1, meh: 2, good: 3, total: 6, p75: 1456},
        },
      });

      const data = initialize({
        query: {
          lcpStart: '20',
        },
      });

      renderWithLayout(data);

      await waitForElementToBeRemoved(() =>
        screen.queryAllByTestId('loading-placeholder')
      );

      expect(
        screen.getByText(
          'If this page is looking a little bare, keep in mind not all browsers support these vitals.'
        )
      ).toBeInTheDocument();
    });

    it('does not render an info alert when data from all web vitals is present', async () => {
      const data = initialize({
        query: {
          lcpStart: '20',
        },
      });

      renderWithLayout(data);

      await waitForElementToBeRemoved(() =>
        screen.queryAllByTestId('loading-placeholder')
      );

      expect(
        screen.queryByText(
          'If this page is looking a little bare, keep in mind not all browsers support these vitals.'
        )
      ).not.toBeInTheDocument();
    });
  });

  it('renders an info alert when some web vitals measurements has no data available', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-vitals/',
      body: {
        'measurements.cls': {poor: 1, meh: 2, good: 3, total: 6, p75: 4567},
        'measurements.fcp': {poor: 1, meh: 2, good: 3, total: 6, p75: 4567},
        'measurements.fid': {poor: 1, meh: 2, good: 3, total: 6, p75: 4567},
        'measurements.fp': {poor: 1, meh: 2, good: 3, total: 6, p75: 1456},
        'measurements.lcp': {poor: 0, meh: 0, good: 0, total: 0, p75: null},
      },
    });

    const data = initialize({
      query: {
        lcpStart: '20',
      },
    });

    renderWithLayout(data);

    await waitForElementToBeRemoved(() => screen.queryAllByTestId('loading-placeholder'));

    expect(
      screen.getByText(
        'If this page is looking a little bare, keep in mind not all browsers support these vitals.'
      )
    ).toBeInTheDocument();
  });
});
