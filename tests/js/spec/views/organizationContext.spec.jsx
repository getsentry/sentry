import React from 'react';

import {mount} from 'enzyme';
import {openSudo} from 'app/actionCreators/modal';
import ConfigStore from 'app/stores/configStore';
import {OrganizationContext} from 'app/views/organizationContext';
import ProjectsStore from 'app/stores/projectsStore';
import TeamStore from 'app/stores/teamStore';
import GlobalSelectionStore from 'app/stores/globalSelectionStore';

jest.mock('app/stores/configStore', () => ({
  get: jest.fn(),
}));
jest.mock('app/actionCreators/modal', () => ({
  openSudo: jest.fn(),
}));

describe('OrganizationContext', function() {
  let wrapper;
  const org = TestStubs.Organization({
    teams: [TestStubs.Team()],
    projects: [TestStubs.Project()],
  });
  let getOrgMock;
  let getEnvironmentsMock;

  const createWrapper = props =>
    mount(
      <OrganizationContext
        api={new MockApiClient()}
        params={{orgId: 'org-slug'}}
        location={{query: {}}}
        routes={[]}
        {...props}
      >
        <div />
      </OrganizationContext>
    );

  beforeEach(function() {
    MockApiClient.clearMockResponses();
    getOrgMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/',
      body: org,
    });
    getEnvironmentsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/environments/',
      body: TestStubs.Environments(),
    });
    jest.spyOn(TeamStore, 'loadInitialData');
    jest.spyOn(ProjectsStore, 'loadInitialData');
    jest.spyOn(GlobalSelectionStore, 'loadInitialData');
  });

  afterEach(function() {
    TeamStore.loadInitialData.mockRestore();
    ProjectsStore.loadInitialData.mockRestore();
    ConfigStore.get.mockRestore();
    GlobalSelectionStore.loadInitialData.mockRestore();
  });

  it('renders and fetches org', async function() {
    wrapper = createWrapper();
    await tick();
    expect(getOrgMock).toHaveBeenCalledWith(
      '/organizations/org-slug/',
      expect.anything()
    );

    expect(wrapper.state('loading')).toBe(false);
    expect(wrapper.state('error')).toBe(false);
    expect(wrapper.state('organization')).toEqual(org);

    expect(TeamStore.loadInitialData).toHaveBeenCalledWith(org.teams);
    expect(ProjectsStore.loadInitialData).toHaveBeenCalledWith(org.projects);
    expect(GlobalSelectionStore.loadInitialData).toHaveBeenCalledWith(org, {});
  });

  it('resets TeamStore when unmounting', async function() {
    wrapper = createWrapper();
    // This `tick` is so that we are not in the middle of a fetch data call when unmounting
    // Otherwise will throw "setState on unmounted component" react warnings
    await tick();
    jest.spyOn(TeamStore, 'reset');
    wrapper.unmount();
    expect(TeamStore.reset).toHaveBeenCalled();
    TeamStore.reset.mockRestore();
  });

  it('fetches new org when router params change', function() {
    wrapper = createWrapper();
    MockApiClient.addMockResponse({
      url: '/organizations/new-slug/environments/',
      body: TestStubs.Environments(),
    });
    const mock = MockApiClient.addMockResponse({
      url: '/organizations/new-slug/',
      body: org,
    });
    wrapper.setProps({params: {orgId: 'new-slug'}});
    wrapper.update();

    expect(mock).toHaveBeenLastCalledWith('/organizations/new-slug/', expect.anything());
  });

  it('fetches new org when router location state is `refresh`', function() {
    wrapper = createWrapper();
    getOrgMock.mockReset();
    wrapper.setProps({location: {state: 'refresh'}});
    wrapper.update();

    expect(getOrgMock).toHaveBeenLastCalledWith(
      '/organizations/org-slug/',
      expect.anything()
    );
    expect(getEnvironmentsMock).toHaveBeenCalled();
  });

  it('shows loading error for non-superusers on 403s', async function() {
    getOrgMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/',
      statusCode: 403,
    });
    console.error = jest.fn(); // eslint-disable-line no-console
    wrapper = createWrapper();

    await tick();
    wrapper.update();

    expect(wrapper.find('LoadingError')).toHaveLength(1);
    console.error.mockRestore(); // eslint-disable-line no-console
  });

  it('opens sudo modal for superusers on 403s', async function() {
    ConfigStore.get.mockImplementation(() => ({
      isSuperuser: true,
    }));
    getOrgMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/',
      statusCode: 403,
    });
    wrapper = createWrapper();

    await tick();
    wrapper.update();

    expect(openSudo).toHaveBeenCalled();
  });

  it('uses last organization from ConfigStore', function() {
    MockApiClient.addMockResponse({
      url: '/organizations/lastOrganization/environments/',
      body: TestStubs.Environments(),
    });
    getOrgMock = MockApiClient.addMockResponse({
      url: '/organizations/lastOrganization/',
      body: org,
    });
    // mocking `.get('lastOrganization')`
    ConfigStore.get.mockImplementation(() => 'lastOrganization');
    wrapper = createWrapper({useLastOrganization: true, params: {}});
    expect(getOrgMock).toHaveBeenLastCalledWith(
      '/organizations/lastOrganization/',
      expect.anything()
    );
  });

  it('uses last organization from `organizations` prop', async function() {
    MockApiClient.addMockResponse({
      url: '/organizations/foo/environments/',
      body: TestStubs.Environments(),
    });
    getOrgMock = MockApiClient.addMockResponse({
      url: '/organizations/foo/',
      body: org,
    });
    ConfigStore.get.mockImplementation(() => '');

    wrapper = createWrapper({
      useLastOrganization: true,
      params: {orgId: 'foo'},
      organizationsLoading: true,
      organizations: [],
    });

    expect(wrapper.find('LoadingIndicator')).toHaveLength(1);

    wrapper.setProps({
      organizationsLoading: false,
      organizations: [
        TestStubs.Organization({slug: 'foo'}),
        TestStubs.Organization({slug: 'bar'}),
      ],
    });
    wrapper.update();

    await tick();
    wrapper.update();
    expect(wrapper.find('LoadingIndicator')).toHaveLength(0);

    expect(getOrgMock).toHaveBeenLastCalledWith('/organizations/foo/', expect.anything());
  });

  it('fetches org details only once if organizations loading store changes', async function() {
    wrapper = createWrapper({
      params: {orgId: 'org-slug'},
      organizationsLoading: true,
      organizations: [],
    });
    await tick();
    wrapper.update();
    expect(wrapper.find('LoadingIndicator')).toHaveLength(0);
    expect(getOrgMock).toHaveBeenCalledTimes(1);

    // Simulate OrganizationsStore being loaded *after* `OrganizationContext` finishes
    // org details fetch
    wrapper.setProps({
      organizationsLoading: false,
      organizations: [
        TestStubs.Organization({slug: 'foo'}),
        TestStubs.Organization({slug: 'bar'}),
      ],
    });

    expect(getOrgMock).toHaveBeenCalledTimes(1);
  });

  it('does not call `GlobalSelectionStore.loadInitialData` on group details route', async function() {
    wrapper = createWrapper({
      routes: [{path: '/organizations/:orgId/issues/:groupId/'}],
    });
    await tick();
    wrapper.update();

    expect(wrapper.state('loading')).toBe(false);
    expect(wrapper.state('error')).toBe(false);

    expect(GlobalSelectionStore.loadInitialData).not.toHaveBeenCalled();
  });
});
