import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import Issues from 'app/views/releases/detail/overview/issues';

describe('Release Issues', function () {
  let newIssuesEndpoint,
    resolvedIssuesEndpoint,
    unhandledIssuesEndpoint,
    allIssuesEndpoint;

  const props = {
    orgId: 'org',
    organization: TestStubs.Organization(),
    version: '1.0.0',
    selection: {projects: [], environments: [], datetime: {period: '14d'}},
    location: {href: ''},
  };

  beforeEach(function () {
    MockApiClient.clearMockResponses();

    MockApiClient.addMockResponse({
      url: `/organizations/${props.organization.slug}/users/`,
      body: [],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${props.organization.slug}/issues-count/?query=first-release%3A%221.0.0%22&query=release%3A%221.0.0%22&query=error.handled%3A0%20release%3A%221.0.0%22&statsPeriod=14d`,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${props.organization.slug}/issues-count/?query=first-release%3A%221.0.0%22&query=release%3A%221.0.0%22&query=error.handled%3A0%20release%3A%221.0.0%22&statsPeriod=24h`,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${props.organization.slug}/releases/1.0.0/resolved/`,
    });

    newIssuesEndpoint = MockApiClient.addMockResponse({
      url: `/organizations/${props.organization.slug}/issues/?groupStatsPeriod=auto&limit=10&query=first-release%3A1.0.0&sort=freq&statsPeriod=14d`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${props.organization.slug}/issues/?groupStatsPeriod=auto&limit=10&query=first-release%3A1.0.0&sort=freq&statsPeriod=24h`,
      body: [],
    });
    resolvedIssuesEndpoint = MockApiClient.addMockResponse({
      url: `/organizations/${props.organization.slug}/releases/1.0.0/resolved/?groupStatsPeriod=auto&limit=10&query=&sort=freq&statsPeriod=14d`,
      body: [],
    });
    unhandledIssuesEndpoint = MockApiClient.addMockResponse({
      url: `/organizations/${props.organization.slug}/issues/?groupStatsPeriod=auto&limit=10&query=release%3A1.0.0%20error.handled%3A0&sort=freq&statsPeriod=14d`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${props.organization.slug}/issues/?groupStatsPeriod=auto&limit=10&query=release%3A1.0.0%20error.handled%3A0&sort=freq&statsPeriod=24h`,
      body: [],
    });
    allIssuesEndpoint = MockApiClient.addMockResponse({
      url: `/organizations/${props.organization.slug}/issues/?groupStatsPeriod=auto&limit=10&query=release%3A1.0.0&sort=freq&statsPeriod=14d`,
      body: [],
    });
  });

  const filterIssues = (wrapper, filter) => {
    wrapper.find('DropdownControl').first().simulate('click');

    wrapper
      .find(`StyledDropdownItem[data-test-id="filter-${filter}"] span`)
      .simulate('click');
  };

  it('shows an empty state', async function () {
    const wrapper = mountWithTheme(<Issues {...props} />);
    const wrapper2 = mountWithTheme(
      <Issues {...props} location={{query: {statsPeriod: '24h'}}} />
    );

    await tick();

    wrapper.update();
    expect(wrapper.find('EmptyStateWarning').text()).toBe(
      'No new issues for the last 14 days.'
    );

    wrapper2.update();
    expect(wrapper2.find('EmptyStateWarning').text()).toBe(
      'No new issues for the last 24 hours.'
    );

    filterIssues(wrapper, 'resolved');
    await tick();
    wrapper.update();
    expect(wrapper.find('EmptyStateWarning').text()).toBe(
      'No resolved issues in this release.'
    );

    filterIssues(wrapper2, 'unhandled');
    await tick();
    wrapper2.update();
    expect(wrapper2.find('EmptyStateWarning').text()).toBe(
      'No unhandled issues for the last 24 hours.'
    );
  });

  it('filters the issues', async function () {
    const wrapper = mountWithTheme(<Issues {...props} />);

    const filterOptions = wrapper.find('DropdownControl StyledDropdownItem');

    expect(filterOptions).toHaveLength(4);
    expect(filterOptions.at(2).text()).toEqual('Unhandled Issues');

    filterIssues(wrapper, 'new');
    expect(newIssuesEndpoint).toHaveBeenCalledTimes(1);

    filterIssues(wrapper, 'resolved');
    expect(resolvedIssuesEndpoint).toHaveBeenCalledTimes(1);

    filterIssues(wrapper, 'unhandled');
    expect(unhandledIssuesEndpoint).toHaveBeenCalledTimes(1);

    filterIssues(wrapper, 'all');
    expect(allIssuesEndpoint).toHaveBeenCalledTimes(1);
  });

  it('renders link to Discover', function () {
    const initializationObj = initializeOrg({
      organization: {
        features: ['discover-basic'],
      },
    });

    const wrapperNoAccess = mountWithTheme(<Issues {...props} />);
    const wrapper = mountWithTheme(
      <Issues {...props} />,
      initializationObj.routerContext
    );

    expect(wrapper.find('Link[data-test-id="discover-button"]').prop('to')).toEqual({
      pathname: `/organizations/${props.organization.slug}/discover/results/`,
      query: {
        id: undefined,
        name: `Release ${props.version}`,
        field: ['issue', 'title', 'count()', 'count_unique(user)', 'project'],
        widths: [-1, -1, -1, -1, -1],
        sort: ['-count'],
        environment: [],
        project: [],
        query: `release:${props.version} !event.type:transaction`,
        yAxis: undefined,
        display: undefined,
        interval: undefined,
        statsPeriod: props.selection.datetime.period,
      },
    });

    expect(wrapperNoAccess.find('Link[data-test-id="discover-button"]').length).toBe(0);
  });

  it('renders link to Issues', function () {
    const wrapper = mountWithTheme(<Issues {...props} />);

    expect(wrapper.find('Link[data-test-id="issues-button"]').prop('to')).toEqual({
      pathname: `/organizations/${props.organization.slug}/issues/`,
      query: {
        sort: 'freq',
        query: 'firstRelease:1.0.0',
        cursor: undefined,
        limit: undefined,
        statsPeriod: '14d',
        groupStatsPeriod: 'auto',
      },
    });

    filterIssues(wrapper, 'resolved');
    expect(wrapper.find('Link[data-test-id="issues-button"]').prop('to')).toEqual({
      pathname: `/organizations/${props.organization.slug}/issues/`,
      query: {
        sort: 'freq',
        query: 'release:1.0.0',
        cursor: undefined,
        limit: undefined,
        statsPeriod: '14d',
        groupStatsPeriod: 'auto',
      },
    });

    filterIssues(wrapper, 'unhandled');
    expect(wrapper.find('Link[data-test-id="issues-button"]').prop('to')).toEqual({
      pathname: `/organizations/${props.organization.slug}/issues/`,
      query: {
        sort: 'freq',
        query: 'release:1.0.0 error.handled:0',
        cursor: undefined,
        limit: undefined,
        statsPeriod: '14d',
        groupStatsPeriod: 'auto',
      },
    });

    filterIssues(wrapper, 'all');
    expect(wrapper.find('Link[data-test-id="issues-button"]').prop('to')).toEqual({
      pathname: `/organizations/${props.organization.slug}/issues/`,
      query: {
        sort: 'freq',
        query: 'release:1.0.0',
        cursor: undefined,
        limit: undefined,
        statsPeriod: '14d',
        groupStatsPeriod: 'auto',
      },
    });
  });
});
