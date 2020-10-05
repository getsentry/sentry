import React from 'react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountWithTheme} from 'sentry-test/enzyme';

import ProjectsStore from 'app/stores/projectsStore';
import RealUserMonitoring from 'app/views/performance/realUserMonitoring';
import {WEB_VITAL_DETAILS} from 'app/views/performance/realUserMonitoring/constants';

function initialize({project, features, transaction} = {}) {
  features = features || ['measurements'];
  project = project || TestStubs.Project();
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
        },
      },
    },
  });
  ProjectsStore.loadInitialData(data.organization.projects);
  return data;
}

const vitals = [
  {heading: 'First Paint (FP)', state: 'fail', baseline: '4.57s'},
  {heading: 'First Contentful Paint (FCP)', state: 'pass', baseline: '1.46s'},
  {heading: 'Largest Contentful Paint (LCP)', state: 'pass', baseline: '1.34s'},
  {heading: 'First Input Delay (FID)', state: 'fail', baseline: '987.00ms'},
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

  it('renders all vitals cards', async function () {
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
});
