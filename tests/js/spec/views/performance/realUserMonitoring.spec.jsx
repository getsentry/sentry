import React from 'react';
import {browserHistory} from 'react-router';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountWithTheme} from 'sentry-test/enzyme';

import ProjectsStore from 'app/stores/projectsStore';
import RealUserMonitoring from 'app/views/performance/realUserMonitoring';
import {WEB_VITAL_DETAILS} from 'app/views/performance/realUserMonitoring/constants';

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
];

describe('Performance > Real User Monitoring', function () {
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
        },
        data: [
          {
            percentile_measurements_fp_0_75: 4567,
            percentile_measurements_fcp_0_75: 1456,
            percentile_measurements_lcp_0_75: 1342,
            percentile_measurements_fid_0_75: 987,
          },
        ],
      },
    });

    const histogramData = [];
    for (let i = 0; i < 100; i++) {
      for (const measurement of Object.values(WEB_VITAL_DETAILS).map(
        detail => detail.slug
      )) {
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
      <RealUserMonitoring organization={organization} location={router.location} />
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
      <RealUserMonitoring
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
      <RealUserMonitoring
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
      <RealUserMonitoring
        organization={organization}
        location={router.location}
        router={router}
      />,
      routerContext
    );

    await tick();
    wrapper.update();

    expect(wrapper.find('Breadcrumb').text()).toEqual(
      expect.stringContaining('Real User Monitoring')
    );
  });

  it('renders all vitals cards correctly', async function () {
    const {organization, router, routerContext} = initialize();

    const wrapper = mountWithTheme(
      <RealUserMonitoring
        organization={organization}
        location={router.location}
        router={router}
      />,
      routerContext
    );

    await tick();
    wrapper.update();

    const vitalCards = wrapper.find('VitalCard');
    expect(vitalCards).toHaveLength(4);

    vitalCards.forEach((vitalCard, i) => {
      expect(vitalCard.find('CardSectionHeading').text()).toEqual(
        expect.stringContaining(vitals[i].heading)
      );
      expect(vitalCard.find('CardSectionHeading').text()).toEqual(
        expect.stringContaining(vitals[i].state)
      );
      expect(vitalCard.find('StatNumber').text()).toEqual(vitals[i].baseline);
    });
    expect(vitalCards.find('BarChart')).toHaveLength(4);
  });

  describe('Open in Discover button', function () {
    it('renders open in discover buttons with required props', function () {
      const {project, organization, router, routerContext} = initialize();

      const wrapper = mountWithTheme(
        <RealUserMonitoring
          organization={organization}
          location={router.location}
          router={router}
        />,
        routerContext
      );

      const buttons = wrapper.find('DiscoverButton');
      expect(buttons).toHaveLength(4);

      buttons.forEach((button, i) => {
        expect(button.prop('to')).toEqual(
          expect.objectContaining({
            pathname: '/organizations/org-slug/discover/results/',
            query: expect.objectContaining({
              field: expect.arrayContaining([`measurements.${vitals[i].slug}`]),
              sort: [`-measurements.${vitals[i].slug}`],
              query: expect.stringContaining('transaction:/'),
              project: [parseInt(project.id, 10)],
            }),
          })
        );
      });
    });

    it('renders open in discover buttons with greater than condition', function () {
      const {organization, router, routerContext} = initialize({
        query: {startMeasurements: '10'},
      });

      const wrapper = mountWithTheme(
        <RealUserMonitoring
          organization={organization}
          location={router.location}
          router={router}
        />,
        routerContext
      );

      const buttons = wrapper.find('DiscoverButton');
      expect(buttons).toHaveLength(4);

      buttons.forEach((button, i) => {
        expect(button.prop('to')).toEqual(
          expect.objectContaining({
            query: expect.objectContaining({
              query: expect.stringContaining(`measurements.${vitals[i].slug}:>=10`),
            }),
          })
        );
      });
    });

    it('renders open in discover buttons with less than condition', function () {
      const {organization, router, routerContext} = initialize({
        query: {endMeasurements: '10'},
      });

      const wrapper = mountWithTheme(
        <RealUserMonitoring
          organization={organization}
          location={router.location}
          router={router}
        />,
        routerContext
      );

      const buttons = wrapper.find('DiscoverButton');
      expect(buttons).toHaveLength(4);

      buttons.forEach((button, i) => {
        expect(button.prop('to')).toEqual(
          expect.objectContaining({
            query: expect.objectContaining({
              query: expect.stringContaining(`measurements.${vitals[i].slug}:<=10`),
            }),
          })
        );
      });
    });

    it('renders open in discover buttons with both condition', function () {
      const {organization, router, routerContext} = initialize({
        query: {
          startMeasurements: '10',
          endMeasurements: '20',
        },
      });

      const wrapper = mountWithTheme(
        <RealUserMonitoring
          organization={organization}
          location={router.location}
          router={router}
        />,
        routerContext
      );

      const buttons = wrapper.find('DiscoverButton');
      expect(buttons).toHaveLength(4);

      buttons.forEach((button, i) => {
        expect(button.prop('to')).toEqual(
          expect.objectContaining({
            query: expect.objectContaining({
              query: expect.stringContaining(`measurements.${vitals[i].slug}:>=10`),
            }),
          })
        );
        expect(button.prop('to')).toEqual(
          expect.objectContaining({
            query: expect.objectContaining({
              query: expect.stringContaining(`measurements.${vitals[i].slug}:<=20`),
            }),
          })
        );
      });
    });
  });

  describe('reset view', function () {
    it('disables button on default view', function () {
      const {organization, router, routerContext} = initialize();

      const wrapper = mountWithTheme(
        <RealUserMonitoring
          organization={organization}
          location={router.location}
          router={router}
        />,
        routerContext
      );

      expect(
        wrapper.find('Button[data-test-id="reset-view"]').prop('disabled')
      ).toBeTruthy();
    });

    it('enables button on left zoom', function () {
      const {organization, router, routerContext} = initialize({
        query: {
          startMeasurements: '20',
        },
      });

      const wrapper = mountWithTheme(
        <RealUserMonitoring
          organization={organization}
          location={router.location}
          router={router}
        />,
        routerContext
      );

      expect(
        wrapper.find('Button[data-test-id="reset-view"]').prop('disabled')
      ).toBeFalsy();
    });

    it('enables button on right zoom', function () {
      const {organization, router, routerContext} = initialize({
        query: {
          endMeasurements: '20',
        },
      });

      const wrapper = mountWithTheme(
        <RealUserMonitoring
          organization={organization}
          location={router.location}
          router={router}
        />,
        routerContext
      );

      expect(
        wrapper.find('Button[data-test-id="reset-view"]').prop('disabled')
      ).toBeFalsy();
    });

    it('enables button on left and right zoom', function () {
      const {organization, router, routerContext} = initialize({
        query: {
          startMeasurements: '20',
          endMeasurements: '20',
        },
      });

      const wrapper = mountWithTheme(
        <RealUserMonitoring
          organization={organization}
          location={router.location}
          router={router}
        />,
        routerContext
      );

      expect(
        wrapper.find('Button[data-test-id="reset-view"]').prop('disabled')
      ).toBeFalsy();
    });

    it('resets view properly', function () {
      const {organization, router, routerContext} = initialize({
        query: {
          startMeasurements: '20',
          endMeasurements: '20',
        },
      });

      const wrapper = mountWithTheme(
        <RealUserMonitoring
          organization={organization}
          location={router.location}
          router={router}
        />,
        routerContext
      );

      wrapper.find('Button[data-test-id="reset-view"]').simulate('click');
      expect(browserHistory.push).toHaveBeenCalledWith({
        query: expect.not.objectContaining({
          startMeasurements: expect.anything(),
          endMeasurements: expect.anything(),
        }),
      });
    });
  });
});
