import {browserHistory} from 'react-router';

import {mountWithTheme} from 'sentry-test/enzyme';

import ManageDashboards from 'app/views/dashboardsV2/manage';

const FEATURES = [
  'global-views',
  'dashboards-basic',
  'dashboards-edit',
  'discover-query',
];

describe('Dashboards > Detail', function () {
  const mockUnauthorizedOrg = TestStubs.Organization({
    features: ['global-views', 'dashboards-basic', 'discover-query'],
  });

  const mockAuthorizedOrg = TestStubs.Organization({
    features: FEATURES,
  });
  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/?sort=name&per_page=9',
      body: [],
    });
  });
  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('denies access on missing feature', function () {
    const wrapper = mountWithTheme(
      <ManageDashboards
        organization={mockUnauthorizedOrg}
        location={{query: {}}}
        router={{}}
      />
    );

    const content = wrapper.find('PageContent');
    expect(content.text()).toContain("You don't have access to this feature");
  });

  it('denies access on no projects', function () {
    const wrapper = mountWithTheme(
      <ManageDashboards
        organization={mockAuthorizedOrg}
        location={{query: {}}}
        router={{}}
      />
    );

    const content = wrapper.find('HelpMessage');
    expect(content.text()).toContain('You need at least one project to use this view');
  });

  it('creates new dashboard', async function () {
    const org = TestStubs.Organization({
      features: FEATURES,
      projects: [TestStubs.Project()],
    });
    const wrapper = mountWithTheme(
      <ManageDashboards organization={org} location={{query: {}}} router={{}} />
    );
    await tick();

    wrapper.find('Button[data-test-id="dashboard-create"]').simulate('click');
    await tick();

    expect(browserHistory.push).toHaveBeenCalledWith({
      pathname: '/organizations/org-slug/dashboards/new/',
      query: {},
    });
  });

  it('can sort', async function () {
    const org = TestStubs.Organization({
      features: FEATURES,
      projects: [TestStubs.Project()],
    });
    const wrapper = mountWithTheme(
      <ManageDashboards organization={org} location={{query: {}}} router={{}} />,
      TestStubs.routerContext()
    );
    await tick();

    const dropdownItems = wrapper.find('DropdownItem span');

    expect(dropdownItems).toHaveLength(4);
    dropdownItems.at(1).simulate('click');

    await tick();

    expect(browserHistory.push).toHaveBeenCalledWith(
      expect.objectContaining({query: {sort: 'title'}})
    );
  });
});
