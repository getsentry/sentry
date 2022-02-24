import {browserHistory} from 'react-router';

import {enforceActOnUseLegacyStoreHook, mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';
import {act} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import {OrganizationContext} from 'sentry/views/organizationContext';
import TransactionVitals from 'sentry/views/performance/transactionSummary/transactionVitals';
import {
  VITAL_GROUPS,
  ZOOM_KEYS,
} from 'sentry/views/performance/transactionSummary/transactionVitals/constants';

function initialize({project, features, transaction, query} = {}) {
  features = features || ['performance-view'];
  project = project || TestStubs.Project();
  query = query || {};
  const data = initializeOrg({
    organization: TestStubs.Organization({
      features,
      projects: [project],
    }),
    router: {
      location: {
        query: {
          transaction: transaction || '/',
          project: project.id,
          ...query,
        },
      },
    },
  });
  act(() => ProjectsStore.loadInitialData(data.organization.projects));
  return data;
}

const WrappedComponent = ({organization, ...props}) => {
  return (
    <OrganizationContext.Provider value={organization}>
      <TransactionVitals organization={organization} {...props} />
    </OrganizationContext.Provider>
  );
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

describe('Performance > Web Vitals', function () {
  enforceActOnUseLegacyStoreHook();

  beforeEach(function () {
    // @ts-ignore no-console
    // eslint-disable-next-line no-console
    console.error = jest.fn();

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [],
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

    const histogramData = {};
    const webVitals = VITAL_GROUPS.reduce((vs, group) => vs.concat(group.vitals), []);

    for (const measurement of webVitals) {
      const data = [];
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
  });

  afterEach(() => {
    // @ts-ignore no-console
    // eslint-disable-next-line no-console
    console.error.mockRestore();
  });

  it('render no access without feature', async function () {
    const {organization, router} = initialize({
      features: [],
    });

    const wrapper = mountWithTheme(
      <WrappedComponent organization={organization} location={router.location} />
    );

    await tick();
    wrapper.update();

    expect(wrapper.text()).toEqual("You don't have access to this feature");
  });

  it('renders the basic UI components', async function () {
    const {organization, router, routerContext} = initialize();

    const wrapper = mountWithTheme(
      <WrappedComponent
        organization={organization}
        location={router.location}
        router={router}
      />,
      routerContext
    );

    await tick();
    wrapper.update();

    expect(wrapper.find('TransactionHeader')).toHaveLength(1);
    expect(wrapper.find('SearchBar')).toHaveLength(1);
    expect(wrapper.find('TransactionVitals')).toHaveLength(1);
  });

  it('renders the correct bread crumbs', async function () {
    const {organization, router, routerContext} = initialize();

    const wrapper = mountWithTheme(
      <WrappedComponent
        organization={organization}
        location={router.location}
        router={router}
      />,
      routerContext
    );

    await tick();
    wrapper.update();

    expect(wrapper.find('Breadcrumb').text()).toEqual(
      expect.stringContaining('Web Vitals')
    );
  });

  it('renders all vitals cards correctly', async function () {
    const {organization, router, routerContext} = initialize();

    const wrapper = mountWithTheme(
      <WrappedComponent
        organization={organization}
        location={router.location}
        router={router}
      />,
      routerContext
    );

    await tick();
    wrapper.update();

    const vitalCards = wrapper.find('VitalCard');
    expect(vitalCards).toHaveLength(5);

    vitalCards.forEach((vitalCard, i) => {
      expect(vitalCard.find('CardSectionHeading').text()).toEqual(
        expect.stringContaining(vitals[i].heading)
      );
      expect(vitalCard.find('StatNumber').text()).toEqual(vitals[i].baseline);
    });
    expect(vitalCards.find('BarChart')).toHaveLength(5);
  });

  describe('reset view', function () {
    it('disables button on default view', async function () {
      const {organization, router, routerContext} = initialize();

      const wrapper = mountWithTheme(
        <WrappedComponent
          organization={organization}
          location={router.location}
          router={router}
        />,
        routerContext
      );

      await tick();
      wrapper.update();

      expect(
        wrapper.find('Button[data-test-id="reset-view"]').prop('disabled')
      ).toBeTruthy();
    });

    it('enables button on left zoom', async function () {
      const {organization, router, routerContext} = initialize({
        query: {
          lcpStart: '20',
        },
      });

      const wrapper = mountWithTheme(
        <WrappedComponent
          organization={organization}
          location={router.location}
          router={router}
        />,
        routerContext
      );

      await tick();
      wrapper.update();

      expect(
        wrapper.find('Button[data-test-id="reset-view"]').prop('disabled')
      ).toBeFalsy();
    });

    it('enables button on right zoom', async function () {
      const {organization, router, routerContext} = initialize({
        query: {
          fpEnd: '20',
        },
      });

      const wrapper = mountWithTheme(
        <WrappedComponent
          organization={organization}
          location={router.location}
          router={router}
        />,
        routerContext
      );

      await tick();
      wrapper.update();

      expect(
        wrapper.find('Button[data-test-id="reset-view"]').prop('disabled')
      ).toBeFalsy();
    });

    it('enables button on left and right zoom', async function () {
      const {organization, router, routerContext} = initialize({
        query: {
          fcpStart: '20',
          fcpEnd: '20',
        },
      });

      const wrapper = mountWithTheme(
        <WrappedComponent
          organization={organization}
          location={router.location}
          router={router}
        />,
        routerContext
      );

      await tick();
      wrapper.update();

      expect(
        wrapper.find('Button[data-test-id="reset-view"]').prop('disabled')
      ).toBeFalsy();
    });

    it('resets view properly', async function () {
      const {organization, router, routerContext} = initialize({
        query: {
          fidStart: '20',
          lcpEnd: '20',
        },
      });

      const wrapper = mountWithTheme(
        <WrappedComponent
          organization={organization}
          location={router.location}
          router={router}
        />,
        routerContext
      );

      await tick();
      wrapper.update();

      wrapper.find('Button[data-test-id="reset-view"]').simulate('click');
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

      const wrapper = mountWithTheme(
        <WrappedComponent
          organization={organization}
          location={router.location}
          router={router}
        />,
        routerContext
      );

      await tick();
      wrapper.update();

      expect(wrapper.find('Alert')).toHaveLength(1);
    });

    it('does not render an info alert when data from all web vitals is present', async function () {
      const {organization, router, routerContext} = initialize({
        query: {
          lcpStart: '20',
        },
      });

      const wrapper = mountWithTheme(
        <WrappedComponent
          organization={organization}
          location={router.location}
          router={router}
        />,
        routerContext
      );

      await tick();
      wrapper.update();

      expect(wrapper.find('Alert')).toHaveLength(0);
    });
  });
});
