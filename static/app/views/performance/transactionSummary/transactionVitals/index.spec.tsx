import {browserHistory} from 'react-router';
import {Location, Query} from 'history';
import {Organization} from 'sentry-fixture/organization';
import {Project as ProjectFixture} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  act,
  render,
  screen,
  userEvent,
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import type {Organization as TOrganization, Project} from 'sentry/types';
import {OrganizationContext} from 'sentry/views/organizationContext';
import TransactionVitals from 'sentry/views/performance/transactionSummary/transactionVitals';
import {
  VITAL_GROUPS,
  ZOOM_KEYS,
} from 'sentry/views/performance/transactionSummary/transactionVitals/constants';

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
    organization: Organization({
      features,
      projects: project ? [project] : [],
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
  act(() => ProjectsStore.loadInitialData(data.organization.projects));
  return data;
}

function WrappedComponent({
  location,
  organization,
}: {
  location: Location;
  organization: TOrganization;
}) {
  return (
    <OrganizationContext.Provider value={organization}>
      <TransactionVitals location={location} organization={organization} />
    </OrganizationContext.Provider>
  );
}

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

describe('Performance > Web Vitals', function () {
  beforeEach(function () {
    // eslint-disable-next-line no-console
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
    const webVitals = VITAL_GROUPS.reduce<string[]>(
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
      url: '/prompts-activity/',
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
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('render no access without feature', function () {
    const {organization, router, routerContext} = initialize({
      features: [],
    });

    render(<WrappedComponent organization={organization} location={router.location} />, {
      context: routerContext,
    });
    expect(screen.getByText("You don't have access to this feature")).toBeInTheDocument();
  });

  it('renders the basic UI components', function () {
    const {organization, router, routerContext} = initialize({
      transaction: '/organizations/:orgId/',
    });

    render(<WrappedComponent organization={organization} location={router.location} />, {
      context: routerContext,
    });

    expect(
      screen.getByRole('heading', {name: '/organizations/:orgId/'})
    ).toBeInTheDocument();

    ['navigation', 'main'].forEach(role => {
      expect(screen.getByRole(role)).toBeInTheDocument();
    });
  });

  it('renders the correct bread crumbs', function () {
    const {organization, router, routerContext} = initialize();

    render(<WrappedComponent organization={organization} location={router.location} />, {
      context: routerContext,
    });

    expect(screen.getByRole('navigation')).toHaveTextContent('PerformanceWeb Vitals');
  });

  describe('renders all vitals cards correctly', function () {
    const {organization, router, routerContext} = initialize();

    beforeEach(() => {
      render(
        <WrappedComponent organization={organization} location={router.location} />,
        {context: routerContext}
      );
    });

    it.each(vitals)('Renders %s', function (vital) {
      expect(screen.getByText(vital.heading)).toBeInTheDocument();
      expect(screen.getByText(vital.baseline)).toBeInTheDocument();
    });
  });

  describe('reset view', function () {
    it('disables button on default view', function () {
      const {organization, router, routerContext} = initialize();

      render(
        <WrappedComponent organization={organization} location={router.location} />,
        {context: routerContext}
      );

      expect(screen.getByRole('button', {name: 'Reset View'})).toBeDisabled();
    });

    it('enables button on left zoom', function () {
      const {organization, router, routerContext} = initialize({
        query: {
          lcpStart: '20',
        },
      });

      render(
        <WrappedComponent organization={organization} location={router.location} />,
        {context: routerContext}
      );

      expect(screen.getByRole('button', {name: 'Reset View'})).toBeEnabled();
    });

    it('enables button on right zoom', function () {
      const {organization, router, routerContext} = initialize({
        query: {
          fpEnd: '20',
        },
      });

      render(
        <WrappedComponent organization={organization} location={router.location} />,
        {context: routerContext}
      );

      expect(screen.getByRole('button', {name: 'Reset View'})).toBeEnabled();
    });

    it('enables button on left and right zoom', function () {
      const {organization, router, routerContext} = initialize({
        query: {
          fcpStart: '20',
          fcpEnd: '20',
        },
      });

      render(
        <WrappedComponent organization={organization} location={router.location} />,
        {context: routerContext}
      );

      expect(screen.getByRole('button', {name: 'Reset View'})).toBeEnabled();
    });

    it('resets view properly', async function () {
      const {organization, router, routerContext} = initialize({
        query: {
          fidStart: '20',
          lcpEnd: '20',
        },
      });

      render(
        <WrappedComponent organization={organization} location={router.location} />,
        {context: routerContext}
      );

      await userEvent.click(screen.getByRole('button', {name: 'Reset View'}));

      expect(browserHistory.push).toHaveBeenCalledWith({
        query: expect.not.objectContaining(
          ZOOM_KEYS.reduce((obj, key) => {
            obj[key] = expect.anything();
            return obj;
          }, {})
        ),
      });
    });

    it('renders an info alert when missing web vitals data', async function () {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events-vitals/',
        body: {
          'measurements.fp': {poor: 1, meh: 2, good: 3, total: 6, p75: 4567},
          'measurements.fcp': {poor: 1, meh: 2, good: 3, total: 6, p75: 1456},
        },
      });

      const {organization, router, routerContext} = initialize({
        query: {
          lcpStart: '20',
        },
      });

      render(
        <WrappedComponent organization={organization} location={router.location} />,
        {context: routerContext}
      );

      await waitForElementToBeRemoved(() =>
        screen.queryAllByTestId('loading-placeholder')
      );

      expect(
        screen.getByText(
          'If this page is looking a little bare, keep in mind not all browsers support these vitals.'
        )
      ).toBeInTheDocument();
    });

    it('does not render an info alert when data from all web vitals is present', async function () {
      const {organization, router, routerContext} = initialize({
        query: {
          lcpStart: '20',
        },
      });

      render(
        <WrappedComponent organization={organization} location={router.location} />,
        {context: routerContext}
      );

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

  it('renders an info alert when some web vitals measurements has no data available', async function () {
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

    const {organization, router, routerContext} = initialize({
      query: {
        lcpStart: '20',
      },
    });

    render(<WrappedComponent organization={organization} location={router.location} />, {
      context: routerContext,
    });

    await waitForElementToBeRemoved(() => screen.queryAllByTestId('loading-placeholder'));

    expect(
      screen.getByText(
        'If this page is looking a little bare, keep in mind not all browsers support these vitals.'
      )
    ).toBeInTheDocument();
  });
});
