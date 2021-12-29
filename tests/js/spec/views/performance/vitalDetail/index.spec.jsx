import {browserHistory} from 'react-router';

import {enforceActOnUseLegacyStoreHook, mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';
import {act} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import TeamStore from 'sentry/stores/teamStore';
import {OrganizationContext} from 'sentry/views/organizationContext';
import VitalDetail from 'sentry/views/performance/vitalDetail/';

function initializeData({query} = {query: {}}) {
  const features = ['discover-basic', 'performance-view'];
  const organization = TestStubs.Organization({
    features,
    projects: [TestStubs.Project()],
  });
  const initialData = initializeOrg({
    organization,
    router: {
      location: {
        query: {
          project: 1,
          ...query,
        },
      },
    },
  });
  act(() => ProjectsStore.loadInitialData(initialData.organization.projects));
  return initialData;
}

const WrappedComponent = ({organization, ...rest}) => {
  return (
    <OrganizationContext.Provider value={organization}>
      <VitalDetail {...rest} />
    </OrganizationContext.Provider>
  );
};

describe('Performance > VitalDetail', function () {
  enforceActOnUseLegacyStoreHook();

  beforeEach(function () {
    act(() => void TeamStore.loadInitialData([], false, null));
    browserHistory.push = jest.fn();
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
      url: '/organizations/org-slug/tags/user.email/values/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/stats/',
      body: [],
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
      url: '/organizations/org-slug/eventsv2/',
      body: {
        meta: {
          count: 'integer',
          p95_measurements_lcp: 'duration',
          transaction: 'string',
          p50_measurements_lcp: 'duration',
          project: 'string',
          compare_numeric_aggregate_p75_measurements_lcp_greater_4000: 'number',
          'project.id': 'integer',
          count_unique_user: 'integer',
          p75_measurements_lcp: 'duration',
        },
        data: [
          {
            count: 100000,
            p95_measurements_lcp: 5000,
            transaction: 'something',
            p50_measurements_lcp: 3500,
            project: 'javascript',
            compare_numeric_aggregate_p75_measurements_lcp_greater_4000: 1,
            count_unique_user: 10000,
            p75_measurements_lcp: 4500,
          },
        ],
      },
      match: [
        (_url, options) => {
          return options.query?.field?.find(f => f === 'p50(measurements.lcp)');
        },
      ],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/eventsv2/',
      body: {
        meta: {
          compare_numeric_aggregate_p75_measurements_cls_greater_0_1: 'number',
          compare_numeric_aggregate_p75_measurements_cls_greater_0_25: 'number',
          count: 'integer',
          count_unique_user: 'integer',
          team_key_transaction: 'boolean',
          p50_measurements_cls: 'number',
          p75_measurements_cls: 'number',
          p95_measurements_cls: 'number',
          project: 'string',
          transaction: 'string',
        },
        data: [
          {
            compare_numeric_aggregate_p75_measurements_cls_greater_0_1: 1,
            compare_numeric_aggregate_p75_measurements_cls_greater_0_25: 0,
            count: 10000,
            count_unique_user: 2740,
            team_key_transaction: 1,
            p50_measurements_cls: 0.143,
            p75_measurements_cls: 0.215,
            p95_measurements_cls: 0.302,
            project: 'javascript',
            transaction: 'something',
          },
        ],
      },
      match: [
        (_url, options) => {
          return options.query?.field?.find(f => f === 'p50(measurements.cls)');
        },
      ],
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
  });

  it('renders basic UI elements', async function () {
    const initialData = initializeData();
    const wrapper = mountWithTheme(
      <WrappedComponent
        organization={initialData.organization}
        location={initialData.router.location}
      />,
      initialData.routerContext
    );
    await tick();
    wrapper.update();

    // It shows a search bar
    expect(wrapper.find('StyledSearchBar')).toHaveLength(1);

    // It shows the vital card
    expect(wrapper.find('VitalInfo')).toHaveLength(1);

    // It shows a chart
    expect(wrapper.find('VitalChart')).toHaveLength(1);

    // It shows a table
    expect(wrapper.find('Table')).toHaveLength(1);
  });

  it('triggers a navigation on search', async function () {
    const initialData = initializeData();
    const wrapper = mountWithTheme(
      <WrappedComponent
        organization={initialData.organization}
        location={initialData.router.location}
      />,
      initialData.routerContext
    );
    await tick();
    wrapper.update();

    // Fill out the search box, and submit it.
    const searchBar = wrapper.find('SearchBar textarea');
    searchBar
      .simulate('change', {target: {value: 'user.email:uhoh*'}})
      .simulate('submit', {preventDefault() {}});

    // Check the navigation.
    expect(browserHistory.push).toHaveBeenCalledTimes(1);
    expect(browserHistory.push).toHaveBeenCalledWith({
      pathname: undefined,
      query: {
        project: 1,
        statsPeriod: '14d',
        query: 'user.email:uhoh*',
      },
    });
  });

  it('Applies conditions when linking to transaction summary', async function () {
    const initialData = initializeData({
      query: {
        query: 'sometag:value',
      },
    });
    const wrapper = mountWithTheme(
      <WrappedComponent
        organization={initialData.organization}
        location={initialData.router.location}
      />,
      initialData.routerContext
    );
    await tick();
    wrapper.update();

    const firstTransactionFromList = wrapper.find('Table GridBody GridRow Link').at(1);

    expect(firstTransactionFromList.prop('to')).toEqual(
      expect.objectContaining({
        pathname: '/organizations/org-slug/performance/summary/',
        query: expect.objectContaining({
          display: 'vitals',
          query: 'sometag:value has:measurements.lcp',
          showTransactions: 'recent',
          statsPeriod: '24h',
          transaction: 'something',
        }),
      })
    );
  });

  it('Check CLS', async function () {
    const initialData = initializeData({
      query: {
        query: 'anothertag:value',
        vitalName: 'measurements.cls',
      },
    });
    const wrapper = mountWithTheme(
      <WrappedComponent
        organization={initialData.organization}
        location={initialData.router.location}
      />,
      initialData.routerContext
    );
    await tick();
    wrapper.update();

    expect(wrapper.find('Title').text()).toEqual('Cumulative Layout Shift');

    const firstTransactionFromList = wrapper.find('Table GridBody GridRow Link').at(1);

    expect(firstTransactionFromList.prop('to')).toEqual(
      expect.objectContaining({
        pathname: '/organizations/org-slug/performance/summary/',
        query: expect.objectContaining({
          display: 'vitals',
          query: 'anothertag:value has:measurements.cls',
          showTransactions: 'recent',
          statsPeriod: '24h',
          transaction: 'something',
        }),
      })
    );

    // Check cells are not in ms
    const firstRow = wrapper.find('GridBody GridRow').first();
    expect(firstRow.find('GridBodyCell').at(6).text()).toEqual('0.215');
  });

  it('Pagination links exist to switch between vitals', async function () {
    const initialData = initializeData({query: {query: 'tag:value'}});
    const wrapper = mountWithTheme(
      <WrappedComponent
        organization={initialData.organization}
        location={initialData.router.location}
      />,
      initialData.routerContext
    );
    await tick();
    wrapper.update();

    const backButton = wrapper.find('HeaderActions ButtonGrid ButtonBar Button').first();
    backButton.simulate('click');

    expect(browserHistory.push).toHaveBeenCalledTimes(1);
    expect(browserHistory.push).toHaveBeenCalledWith({
      pathname: undefined,
      query: {
        project: 1,
        query: 'tag:value',
        vitalName: 'measurements.fcp',
      },
    });
  });

  it('Check LCP vital renders correctly', async function () {
    const initialData = initializeData({query: {query: 'tag:value'}});
    const wrapper = mountWithTheme(
      <WrappedComponent
        organization={initialData.organization}
        location={initialData.router.location}
      />,
      initialData.routerContext
    );
    await tick();
    wrapper.update();

    expect(wrapper.find('Title').text()).toEqual('Largest Contentful Paint');

    expect(wrapper.find('[data-test-id="vital-bar-p75"]').text()).toEqual(
      'The p75 for all transactions is 4500ms'
    );

    const firstRow = wrapper.find('GridBody GridRow').first();
    expect(firstRow.find('GridBodyCell').at(6).text()).toEqual('4.50s');
  });
});
