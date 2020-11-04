import React from 'react';
import {browserHistory} from 'react-router';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountWithTheme} from 'sentry-test/enzyme';

import ProjectsStore from 'app/stores/projectsStore';
import TransactionVitals from 'app/views/performance/transactionVitals';
import {
  WEB_VITAL_DETAILS,
  ZOOM_KEYS,
} from 'app/views/performance/transactionVitals/constants';

function initialize({project, features, transaction, query} = {}) {
  features = features || ['measurements'];
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
  ProjectsStore.loadInitialData(data.organization.projects);
  return data;
}

/**
 * These values are what we expect to see on the page based on the
 * mocked api responses below.
 */
const vitals = [
  {
    slug: 'fp',
    heading: 'First Paint (FP)',
    state: 'fail',
    baseline: '4.57s',
  },
  {
    slug: 'fcp',
    heading: 'First Contentful Paint (FCP)',
    state: 'pass',
    baseline: '1.46s',
  },
  {
    slug: 'lcp',
    heading: 'Largest Contentful Paint (LCP)',
    state: 'pass',
    baseline: '1.34s',
  },
  {
    slug: 'fid',
    heading: 'First Input Delay (FID)',
    state: 'fail',
    baseline: '987.00ms',
  },
  {
    slug: 'cls',
    heading: 'Cumulative Layout Shift (CLS)',
    state: 'pass',
    baseline: '0.02',
  },
];

describe('Performance > Web Vitals', function () {
  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/is-key-transactions/',
      body: [],
    });
    // Mock baseline measurements
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/eventsv2/',
      body: {
        meta: {
          percentile_measurements_fp_0_75: 'duration',
          percentile_measurements_fcp_0_75: 'duration',
          percentile_measurements_lcp_0_75: 'duration',
          percentile_measurements_fid_0_75: 'duration',
          percentile_measurements_cls_0_75: 'number',
        },
        data: [
          {
            percentile_measurements_fp_0_75: 4567,
            percentile_measurements_fcp_0_75: 1456,
            percentile_measurements_lcp_0_75: 1342,
            percentile_measurements_fid_0_75: 987,
            percentile_measurements_cls_0_75: 0.02,
          },
        ],
      },
    });

    const histogramData = [];
    const webVitals = Object.entries(WEB_VITAL_DETAILS)
      .filter(([, value]) => value.display)
      .map(([, detail]) => detail.slug);

    for (let i = 0; i < 100; i++) {
      for (const measurement of webVitals) {
        histogramData.push({
          key: measurement,
          bin: i,
          count: i,
        });
      }
    }
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-measurements-histogram/',
      body: {
        meta: {key: 'string', bin: 'number', count: 'number'},
        data: histogramData,
      },
    });
  });

  it('render no access without feature', async function () {
    const {organization, router} = initialize({
      features: [],
    });

    const wrapper = mountWithTheme(
      <TransactionVitals organization={organization} location={router.location} />
    );

    await tick();
    wrapper.update();

    expect(wrapper.text()).toEqual("You don't have access to this feature");
  });

  it('redirects to transaction summary if possible', async function () {
    const {organization, router} = initialize({
      features: ['performance-view'],
    });

    const wrapper = mountWithTheme(
      <TransactionVitals
        organization={organization}
        location={router.location}
        router={router}
      />
    );

    await tick();
    wrapper.update();

    expect(router.replace).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/organizations/org-slug/performance/summary/',
      })
    );
  });

  it('renders the basic UI components', async function () {
    const {organization, router, routerContext} = initialize();

    const wrapper = mountWithTheme(
      <TransactionVitals
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
      <TransactionVitals
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
      <TransactionVitals
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
      expect(vitalCard.find('CardSectionHeading').text()).toEqual(
        expect.stringContaining(vitals[i].state)
      );
      expect(vitalCard.find('StatNumber').text()).toEqual(vitals[i].baseline);
    });
    expect(vitalCards.find('BarChart')).toHaveLength(5);
  });

  describe('Open in Discover button', function () {
    it('renders open in discover buttons with required props', async function () {
      const {project, organization, router, routerContext} = initialize();

      const wrapper = mountWithTheme(
        <TransactionVitals
          organization={organization}
          location={router.location}
          router={router}
        />,
        routerContext
      );

      await tick();
      wrapper.update();

      const buttons = wrapper.find('DiscoverButton');
      expect(buttons).toHaveLength(5);

      buttons.forEach((button, i) => {
        expect(button.prop('to')).toEqual(
          expect.objectContaining({
            pathname: '/organizations/org-slug/discover/results/',
            query: expect.objectContaining({
              field: expect.arrayContaining([
                `percentile(measurements.${vitals[i].slug},0.75)`,
              ]),
              sort: [`-percentile_measurements_${vitals[i].slug}_0_75`],
              query: expect.stringContaining('transaction:/'),
              project: [parseInt(project.id, 10)],
            }),
          })
        );
      });
    });

    it('renders open in discover buttons with greater than condition', async function () {
      const query = {
        fpStart: '10',
        fcpStart: '10',
        lcpStart: '10',
        fidStart: '10',
        clsStart: '0.01',
      };
      const {organization, router, routerContext} = initialize({query});

      const wrapper = mountWithTheme(
        <TransactionVitals
          organization={organization}
          location={router.location}
          router={router}
        />,
        routerContext
      );

      await tick();
      wrapper.update();

      const buttons = wrapper.find('DiscoverButton');
      expect(buttons).toHaveLength(5);

      buttons.forEach((button, i) => {
        const slug = vitals[i].slug;
        const key = `measurements.${slug}`;
        const value = query[`${slug}Start`];
        expect(button.prop('to')).toEqual(
          expect.objectContaining({
            query: expect.objectContaining({
              query: expect.stringContaining(`${key}:>=${value}`),
            }),
          })
        );
      });
    });

    it('renders open in discover buttons with less than condition', async function () {
      const query = {
        fpEnd: '20',
        fcpEnd: '20',
        lcpEnd: '20',
        fidEnd: '20',
        clsEnd: '0.03',
      };
      const {organization, router, routerContext} = initialize({query});

      const wrapper = mountWithTheme(
        <TransactionVitals
          organization={organization}
          location={router.location}
          router={router}
        />,
        routerContext
      );

      await tick();
      wrapper.update();

      const buttons = wrapper.find('DiscoverButton');
      expect(buttons).toHaveLength(5);

      buttons.forEach((button, i) => {
        const slug = vitals[i].slug;
        const key = `measurements.${slug}`;
        const value = query[`${slug}End`];
        expect(button.prop('to')).toEqual(
          expect.objectContaining({
            query: expect.objectContaining({
              query: expect.stringContaining(`${key}:<=${value}`),
            }),
          })
        );
      });
    });

    it('renders open in discover buttons with both condition', async function () {
      const query = {
        fpStart: '10',
        fpEnd: '20',
        fcpStart: '10',
        fcpEnd: '20',
        lcpStart: '10',
        lcpEnd: '20',
        fidStart: '10',
        fidEnd: '20',
        clsStart: '0.01',
        clsEnd: '0.03',
      };
      const {organization, router, routerContext} = initialize({query});

      const wrapper = mountWithTheme(
        <TransactionVitals
          organization={organization}
          location={router.location}
          router={router}
        />,
        routerContext
      );

      await tick();
      wrapper.update();

      const buttons = wrapper.find('DiscoverButton');
      expect(buttons).toHaveLength(5);

      buttons.forEach((button, i) => {
        const slug = vitals[i].slug;
        const key = `measurements.${slug}`;
        const start = query[`${slug}Start`];
        const end = query[`${slug}End`];
        expect(button.prop('to')).toEqual(
          expect.objectContaining({
            query: expect.objectContaining({
              query: expect.stringContaining(`${key}:>=${start}`),
            }),
          })
        );
        expect(button.prop('to')).toEqual(
          expect.objectContaining({
            query: expect.objectContaining({
              query: expect.stringContaining(`${key}:<=${end}`),
            }),
          })
        );
      });
    });
  });

  describe('reset view', function () {
    it('disables button on default view', async function () {
      const {organization, router, routerContext} = initialize();

      const wrapper = mountWithTheme(
        <TransactionVitals
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
        <TransactionVitals
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
        <TransactionVitals
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
        <TransactionVitals
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
        <TransactionVitals
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
  });
});
