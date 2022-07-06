import {mountWithTheme} from 'sentry-test/enzyme';

import ReleaseIssues from 'sentry/views/releases/detail/overview/releaseIssues';
import {getReleaseBounds} from 'sentry/views/releases/utils';

describe('ReleaseIssues', function () {
  let newIssuesEndpoint,
    resolvedIssuesEndpoint,
    unhandledIssuesEndpoint,
    allIssuesEndpoint;

  const props = {
    orgId: 'org',
    organization: TestStubs.Organization(),
    version: '1.0.0',
    selection: {projects: [], environments: [], datetime: {}},
    location: {href: '', query: {}},
    releaseBounds: getReleaseBounds(TestStubs.Release({version: '1.0.0'})),
  };

  beforeEach(function () {
    MockApiClient.clearMockResponses();

    MockApiClient.addMockResponse({
      url: `/organizations/${props.organization.slug}/users/`,
      body: [],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${props.organization.slug}/issues-count/?end=2020-03-24T02%3A04%3A59Z&query=first-release%3A%221.0.0%22&query=release%3A%221.0.0%22&query=error.handled%3A0%20release%3A%221.0.0%22&query=regressed_in_release%3A%221.0.0%22&start=2020-03-23T01%3A02%3A00Z`,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${props.organization.slug}/issues-count/?query=first-release%3A%221.0.0%22&query=release%3A%221.0.0%22&query=error.handled%3A0%20release%3A%221.0.0%22&query=regressed_in_release%3A%221.0.0%22&statsPeriod=24h`,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${props.organization.slug}/releases/1.0.0/resolved/`,
    });

    newIssuesEndpoint = MockApiClient.addMockResponse({
      url: `/organizations/${props.organization.slug}/issues/?end=2020-03-24T02%3A04%3A59Z&groupStatsPeriod=auto&limit=10&query=first-release%3A1.0.0&sort=freq&start=2020-03-23T01%3A02%3A00Z`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${props.organization.slug}/issues/?groupStatsPeriod=auto&limit=10&query=first-release%3A1.0.0&sort=freq&statsPeriod=24h`,
      body: [],
    });
    resolvedIssuesEndpoint = MockApiClient.addMockResponse({
      url: `/organizations/${props.organization.slug}/releases/1.0.0/resolved/?end=2020-03-24T02%3A04%3A59Z&groupStatsPeriod=auto&limit=10&query=&sort=freq&start=2020-03-23T01%3A02%3A00Z`,
      body: [],
    });
    unhandledIssuesEndpoint = MockApiClient.addMockResponse({
      url: `/organizations/${props.organization.slug}/issues/?end=2020-03-24T02%3A04%3A59Z&groupStatsPeriod=auto&limit=10&query=release%3A1.0.0%20error.handled%3A0&sort=freq&start=2020-03-23T01%3A02%3A00Z`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${props.organization.slug}/issues/?groupStatsPeriod=auto&limit=10&query=release%3A1.0.0%20error.handled%3A0&sort=freq&statsPeriod=24h`,
      body: [],
    });
    allIssuesEndpoint = MockApiClient.addMockResponse({
      url: `/organizations/${props.organization.slug}/issues/?end=2020-03-24T02%3A04%3A59Z&groupStatsPeriod=auto&limit=10&query=release%3A1.0.0&sort=freq&start=2020-03-23T01%3A02%3A00Z`,
      body: [],
    });
  });

  const filterIssues = (wrapper, filter) => {
    wrapper.find(`ButtonBar Button[data-test-id="filter-${filter}"]`).simulate('click');
  };

  it('shows an empty state', async function () {
    const wrapper = mountWithTheme(<ReleaseIssues {...props} />);
    const wrapper2 = mountWithTheme(
      <ReleaseIssues {...props} location={{query: {pageStatsPeriod: '24h'}}} />
    );

    await tick();

    wrapper.update();
    expect(wrapper.find('EmptyStateWarning').text()).toBe(
      'No new issues in this release.'
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

  it('filters the issues', function () {
    const wrapper = mountWithTheme(<ReleaseIssues {...props} />);

    const filterOptions = wrapper.find('ButtonBar Button');

    expect(filterOptions).toHaveLength(6); // sixth one is "Open Issues" button
    expect(filterOptions.at(2).text()).toEqual('Unhandled');

    filterIssues(wrapper, 'new');
    expect(newIssuesEndpoint).toHaveBeenCalledTimes(1);

    filterIssues(wrapper, 'resolved');
    expect(resolvedIssuesEndpoint).toHaveBeenCalledTimes(1);

    filterIssues(wrapper, 'unhandled');
    expect(unhandledIssuesEndpoint).toHaveBeenCalledTimes(1);

    filterIssues(wrapper, 'all');
    expect(allIssuesEndpoint).toHaveBeenCalledTimes(1);
  });

  it('renders link to Issues', function () {
    const wrapper = mountWithTheme(<ReleaseIssues {...props} />);

    expect(wrapper.find('Link[data-test-id="issues-button"]').prop('to')).toEqual({
      pathname: `/organizations/${props.organization.slug}/issues/`,
      query: {
        sort: 'freq',
        query: 'firstRelease:1.0.0',
        cursor: undefined,
        limit: undefined,
        start: '2020-03-23T01:02:00Z',
        end: '2020-03-24T02:04:59Z',
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
        start: '2020-03-23T01:02:00Z',
        end: '2020-03-24T02:04:59Z',
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
        start: '2020-03-23T01:02:00Z',
        end: '2020-03-24T02:04:59Z',
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
        start: '2020-03-23T01:02:00Z',
        end: '2020-03-24T02:04:59Z',
        groupStatsPeriod: 'auto',
      },
    });
  });
});
