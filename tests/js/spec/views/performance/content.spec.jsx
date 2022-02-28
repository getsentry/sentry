import {browserHistory} from 'react-router';

import {enforceActOnUseLegacyStoreHook, mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';
import {act} from 'sentry-test/reactTestingLibrary';

import * as pageFilters from 'sentry/actionCreators/pageFilters';
import OrganizationStore from 'sentry/stores/organizationStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import TeamStore from 'sentry/stores/teamStore';
import {OrganizationContext} from 'sentry/views/organizationContext';
import PerformanceContent from 'sentry/views/performance/content';
import {DEFAULT_MAX_DURATION} from 'sentry/views/performance/trends/utils';

const FEATURES = ['performance-view'];

function WrappedComponent({organization, location}) {
  return (
    <OrganizationContext.Provider value={organization}>
      <PerformanceContent organization={organization} location={location} />
    </OrganizationContext.Provider>
  );
}

function initializeData(projects, query, features = FEATURES) {
  const organization = TestStubs.Organization({
    features,
    projects,
  });
  const initialData = initializeOrg({
    organization,
    router: {
      location: {
        query: query || {},
      },
    },
  });
  act(() => void OrganizationStore.onUpdate(initialData.organization, {replace: true}));
  act(() => ProjectsStore.loadInitialData(initialData.organization.projects));
  return initialData;
}

function initializeTrendsData(query, addDefaultQuery = true) {
  const projects = [
    TestStubs.Project({id: '1', firstTransactionEvent: false}),
    TestStubs.Project({id: '2', firstTransactionEvent: true}),
  ];
  const organization = TestStubs.Organization({
    FEATURES,
    projects,
  });

  const otherTrendsQuery = addDefaultQuery
    ? {
        query: `tpm():>0.01 transaction.duration:>0 transaction.duration:<${DEFAULT_MAX_DURATION}`,
      }
    : {};

  const initialData = initializeOrg({
    organization,
    router: {
      location: {
        query: {
          ...otherTrendsQuery,
          ...query,
        },
      },
    },
  });
  act(() => ProjectsStore.loadInitialData(initialData.organization.projects));
  return initialData;
}

describe('Performance > Content', function () {
  enforceActOnUseLegacyStoreHook();

  beforeEach(function () {
    act(() => void TeamStore.loadInitialData([], false, null));
    browserHistory.push = jest.fn();
    jest.spyOn(pageFilters, 'updateDateTime');

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: {data: [[123, []]]},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-histogram/',
      body: {'transaction.duration': [{bin: 0, count: 1000}]},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/users/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      method: 'POST',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/sdk-updates/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/prompts-activity/',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/eventsv2/',
      body: {
        meta: {
          user: 'string',
          transaction: 'string',
          'project.id': 'integer',
          tpm: 'number',
          p50: 'number',
          p95: 'number',
          failure_rate: 'number',
          apdex_300: 'number',
          count_unique_user: 'number',
          count_miserable_user_300: 'number',
          user_misery_300: 'number',
        },
        data: [
          {
            transaction: '/apple/cart',
            'project.id': 1,
            user: 'uhoh@example.com',
            tpm: 30,
            p50: 100,
            p95: 500,
            failure_rate: 0.1,
            apdex_300: 0.6,
            count_unique_user: 1000,
            count_miserable_user_300: 122,
            user_misery_300: 0.114,
          },
        ],
      },
      match: [
        (_, options) => {
          if (!options.hasOwnProperty('query')) {
            return false;
          }
          if (!options.query.hasOwnProperty('field')) {
            return false;
          }
          return !options.query.field.includes('team_key_transaction');
        },
      ],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/eventsv2/',
      body: {
        meta: {
          user: 'string',
          transaction: 'string',
          'project.id': 'integer',
          tpm: 'number',
          p50: 'number',
          p95: 'number',
          failure_rate: 'number',
          apdex_300: 'number',
          count_unique_user: 'number',
          count_miserable_user_300: 'number',
          user_misery_300: 'number',
        },
        data: [
          {
            team_key_transaction: 1,
            transaction: '/apple/cart',
            'project.id': 1,
            user: 'uhoh@example.com',
            tpm: 30,
            p50: 100,
            p95: 500,
            failure_rate: 0.1,
            apdex_300: 0.6,
            count_unique_user: 1000,
            count_miserable_user_300: 122,
            user_misery_300: 0.114,
          },
          {
            team_key_transaction: 0,
            transaction: '/apple/checkout',
            'project.id': 1,
            user: 'uhoh@example.com',
            tpm: 30,
            p50: 100,
            p95: 500,
            failure_rate: 0.1,
            apdex_300: 0.6,
            count_unique_user: 1000,
            count_miserable_user_300: 122,
            user_misery_300: 0.114,
          },
        ],
      },
      match: [
        (_, options) => {
          if (!options.hasOwnProperty('query')) {
            return false;
          }
          if (!options.query.hasOwnProperty('field')) {
            return false;
          }
          return options.query.field.includes('team_key_transaction');
        },
      ],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-meta/',
      body: {
        count: 2,
      },
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-trends/',
      body: {
        stats: {},
        events: {meta: {}, data: []},
      },
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-trends-stats/',
      body: {
        stats: {},
        events: {meta: {}, data: []},
      },
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-vitals/',
      body: {
        'measurements.lcp': {
          poor: 1,
          meh: 2,
          good: 3,
          total: 6,
          p75: 4500,
        },
      },
    });
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/key-transactions-list/`,
      body: [],
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
    act(() => ProjectsStore.reset());
    pageFilters.updateDateTime.mockRestore();
  });

  it('renders basic UI elements', async function () {
    const projects = [TestStubs.Project({firstTransactionEvent: true})];
    const data = initializeData(projects, {});

    const wrapper = mountWithTheme(
      <WrappedComponent
        organization={data.organization}
        location={data.router.location}
      />,
      data.routerContext
    );

    await act(async () => {
      await tick();
      wrapper.update();
    });

    // performance landing container
    expect(wrapper.find('div[data-test-id="performance-landing-v3"]').exists()).toBe(
      true
    );

    // No onboarding should show.
    expect(wrapper.find('Onboarding')).toHaveLength(0);

    // Table should render.
    expect(wrapper.find('Table')).toHaveLength(1);

    wrapper.unmount();
  });

  it('renders onboarding state when the selected project has no events', async function () {
    const projects = [
      TestStubs.Project({id: 1, firstTransactionEvent: false}),
      TestStubs.Project({id: 2, firstTransactionEvent: true}),
    ];
    const data = initializeData(projects, {project: [1]});

    const wrapper = mountWithTheme(
      <WrappedComponent
        organization={data.organization}
        location={data.router.location}
      />,
      data.routerContext
    );

    await act(async () => {
      await tick();
      wrapper.update();
    });

    // onboarding should show.
    expect(wrapper.find('Onboarding')).toHaveLength(1);

    // Table should not show.
    expect(wrapper.find('Table')).toHaveLength(0);
    wrapper.unmount();
  });

  it('does not render onboarding for "my projects"', async function () {
    const projects = [
      TestStubs.Project({id: '1', firstTransactionEvent: false}),
      TestStubs.Project({id: '2', firstTransactionEvent: true}),
    ];
    const data = initializeData(projects, {project: ['-1']});

    const wrapper = mountWithTheme(
      <WrappedComponent
        organization={data.organization}
        location={data.router.location}
      />,
      data.routerContext
    );

    await act(async () => {
      await tick();
      wrapper.update();
    });

    expect(wrapper.find('Onboarding')).toHaveLength(0);
    wrapper.unmount();
  });

  it('forwards conditions to transaction summary', async function () {
    const projects = [TestStubs.Project({id: '1', firstTransactionEvent: true})];
    const data = initializeData(projects, {project: ['1'], query: 'sentry:yes'});

    const wrapper = mountWithTheme(
      <WrappedComponent
        organization={data.organization}
        location={data.router.location}
      />,
      data.routerContext
    );

    await act(async () => {
      await tick();
      wrapper.update();
    });

    const link = wrapper.find('[data-test-id="grid-editable"] GridBody Link').at(0);
    link.simulate('click', {button: 0});

    expect(data.router.push).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({
          transaction: '/apple/cart',
          query: 'sentry:yes transaction.duration:<15m',
        }),
      })
    );
    wrapper.unmount();
  });

  it('Default period for trends does not call updateDateTime', async function () {
    const data = initializeTrendsData({query: 'tag:value'}, false);
    const wrapper = mountWithTheme(
      <WrappedComponent
        organization={data.organization}
        location={data.router.location}
      />,
      data.routerContext
    );

    await act(async () => {
      await tick();
      wrapper.update();
    });

    expect(pageFilters.updateDateTime).toHaveBeenCalledTimes(0);
    wrapper.unmount();
  });

  it('Navigating to trends does not modify statsPeriod when already set', async function () {
    const data = initializeTrendsData({
      query: `tpm():>0.005 transaction.duration:>10 transaction.duration:<${DEFAULT_MAX_DURATION} api`,
      statsPeriod: '24h',
    });

    const wrapper = mountWithTheme(
      <WrappedComponent
        organization={data.organization}
        location={data.router.location}
      />,
      data.routerContext
    );

    await act(async () => {
      await tick();
      wrapper.update();
    });

    const trendsLink = wrapper.find('[data-test-id="landing-header-trends"]').at(0);
    trendsLink.simulate('click');

    expect(pageFilters.updateDateTime).toHaveBeenCalledTimes(0);

    expect(browserHistory.push).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/organizations/org-slug/performance/trends/',
        query: {
          query: `tpm():>0.005 transaction.duration:>10 transaction.duration:<${DEFAULT_MAX_DURATION}`,
          statsPeriod: '24h',
        },
      })
    );
    wrapper.unmount();
  });

  it('Default page (transactions) without trends feature will not update filters if none are set', async function () {
    const projects = [
      TestStubs.Project({id: 1, firstTransactionEvent: false}),
      TestStubs.Project({id: 2, firstTransactionEvent: true}),
    ];
    const data = initializeData(projects, {view: undefined});

    const wrapper = mountWithTheme(
      <WrappedComponent
        organization={data.organization}
        location={data.router.location}
      />,
      data.routerContext
    );

    await act(async () => {
      await tick();
      wrapper.update();
    });

    expect(browserHistory.push).toHaveBeenCalledTimes(0);
    wrapper.unmount();
  });

  it('Default page (transactions) with trends feature will not update filters if none are set', async function () {
    const data = initializeTrendsData({view: undefined}, false);

    const wrapper = mountWithTheme(
      <WrappedComponent
        organization={data.organization}
        location={data.router.location}
      />,
      data.routerContext
    );

    await act(async () => {
      await tick();
      wrapper.update();
    });

    expect(browserHistory.push).toHaveBeenCalledTimes(0);
    wrapper.unmount();
  });

  it('Tags are replaced with trends default query if navigating to trends', async function () {
    const data = initializeTrendsData({query: 'device.family:Mac'}, false);

    const wrapper = mountWithTheme(
      <WrappedComponent
        organization={data.organization}
        location={data.router.location}
      />,
      data.routerContext
    );

    await act(async () => {
      await tick();
      wrapper.update();
    });

    const trendsLink = wrapper.find('[data-test-id="landing-header-trends"]').at(0);
    trendsLink.simulate('click');

    expect(browserHistory.push).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/organizations/org-slug/performance/trends/',
        query: {
          query: `tpm():>0.01 transaction.duration:>0 transaction.duration:<${DEFAULT_MAX_DURATION}`,
        },
      })
    );
    wrapper.unmount();
  });

  it('Display Create Sample Transaction Button', async function () {
    const projects = [
      TestStubs.Project({id: 1, firstTransactionEvent: false}),
      TestStubs.Project({id: 2, firstTransactionEvent: false}),
    ];
    const data = initializeData(projects, {view: undefined});

    const wrapper = mountWithTheme(
      <WrappedComponent
        organization={data.organization}
        location={data.router.location}
      />,
      data.routerContext
    );

    await act(async () => {
      await tick();
      wrapper.update();
    });

    expect(
      wrapper.find('Button[data-test-id="create-sample-transaction-btn"]').exists()
    ).toBe(true);
    wrapper.unmount();
  });
});
