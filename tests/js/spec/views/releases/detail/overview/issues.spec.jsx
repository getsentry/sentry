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
    version: '1.0.0',
    selection: {projects: [], environments: [], datetime: {period: '14d'}},
    location: {href: ''},
  };

  beforeEach(function () {
    MockApiClient.clearMockResponses();

    MockApiClient.addMockResponse({
      url: `/organizations/${props.orgId}/users/`,
      body: [],
    });

    newIssuesEndpoint = MockApiClient.addMockResponse({
      url: `/organizations/${props.orgId}/issues/?limit=50&query=first-release%3A1.0.0&sort=new`,
      body: [],
    });
    resolvedIssuesEndpoint = MockApiClient.addMockResponse({
      url: '/organizations/org/releases/1.0.0/resolved/?limit=50&query=&sort=new',
      body: [],
    });
    unhandledIssuesEndpoint = MockApiClient.addMockResponse({
      url:
        '/organizations/org/issues/?limit=50&query=release%3A1.0.0%20error.handled%3A0&sort=new',
      body: [],
    });
    allIssuesEndpoint = MockApiClient.addMockResponse({
      url: '/organizations/org/issues/?limit=50&query=release%3A1.0.0&sort=new',
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
      <Issues {...props} selection={{datetime: {period: '24h'}}} />
    );

    expect(wrapper.find('EmptyStateWarning').text()).toBe(
      'No new issues in this release for the last 14 days.'
    );
    expect(wrapper2.find('EmptyStateWarning').text()).toBe(
      'No new issues in this release for the last 24 hours.'
    );

    filterIssues(wrapper, 'resolved');
    expect(wrapper.find('EmptyStateWarning').text()).toBe(
      'No resolved issues in this release.'
    );

    filterIssues(wrapper2, 'unhandled');
    expect(wrapper2.find('EmptyStateWarning').text()).toBe(
      'No unhandled issues in this release for the last 24 hours.'
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
      pathname: '/organizations/org/discover/results/',
      query: {
        id: undefined,
        name: `Release ${props.version}`,
        field: ['title', 'count()', 'event.type', 'issue', 'last_seen()'],
        widths: [-1, -1, -1, -1, -1],
        sort: ['-last_seen'],
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
      pathname: '/organizations/org/issues/',
      query: {limit: 50, sort: 'new', query: 'firstRelease:1.0.0'},
    });

    filterIssues(wrapper, 'resolved');
    expect(wrapper.find('Link[data-test-id="issues-button"]').prop('to')).toEqual({
      pathname: '/organizations/org/issues/',
      query: {limit: 50, sort: 'new', query: 'release:1.0.0'},
    });

    filterIssues(wrapper, 'unhandled');
    expect(wrapper.find('Link[data-test-id="issues-button"]').prop('to')).toEqual({
      pathname: '/organizations/org/issues/',
      query: {limit: 50, sort: 'new', query: 'release:1.0.0 error.handled:0'},
    });

    filterIssues(wrapper, 'all');
    expect(wrapper.find('Link[data-test-id="issues-button"]').prop('to')).toEqual({
      pathname: '/organizations/org/issues/',
      query: {limit: 50, sort: 'new', query: 'release:1.0.0'},
    });
  });
});
