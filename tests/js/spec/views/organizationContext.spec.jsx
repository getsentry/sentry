import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import {openSudo} from 'app/actionCreators/modal';
import * as OrganizationActionCreator from 'app/actionCreators/organization';
import ConfigStore from 'app/stores/configStore';
import {OrganizationContext} from 'app/views/organizationContext';
import ProjectsStore from 'app/stores/projectsStore';
import TeamStore from 'app/stores/teamStore';
import OrganizationStore from 'app/stores/organizationStore';

jest.mock('app/stores/configStore', () => ({
  get: jest.fn(),
}));
jest.mock('app/actionCreators/modal', () => ({
  openSudo: jest.fn(),
}));

describe('OrganizationContext', function () {
  let wrapper;
  const org = TestStubs.Organization({
    teams: [TestStubs.Team()],
    projects: [TestStubs.Project()],
  });
  const api = new MockApiClient();
  let getOrgMock;

  const createWrapper = props => {
    wrapper = mountWithTheme(
      <OrganizationContext
        api={api}
        params={{orgId: 'org-slug'}}
        location={{query: {}}}
        routes={[]}
        {...props}
      >
        <div />
      </OrganizationContext>
    );
    return wrapper;
  };

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    getOrgMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/',
      body: org,
    });
    jest.spyOn(TeamStore, 'loadInitialData');
    jest.spyOn(ProjectsStore, 'loadInitialData');
    jest.spyOn(OrganizationActionCreator, 'fetchOrganizationDetails');
  });

  afterEach(async function () {
    // Ugh these stores are a pain
    // It's possible that a test still has an update action in flight
    // and caues store to update *AFTER* we reset. Attempt to flush out updates
    await tick();
    await tick();
    wrapper.unmount();
    OrganizationStore.reset();
    // await for store change to finish propagating
    await tick();
    await tick();

    TeamStore.loadInitialData.mockRestore();
    ProjectsStore.loadInitialData.mockRestore();
    ConfigStore.get.mockRestore();
    OrganizationActionCreator.fetchOrganizationDetails.mockRestore();
  });

  it('renders and fetches org', async function () {
    wrapper = createWrapper();
    // await dispatching the action to org store
    await tick();
    // await resolving the api promise from action creator and updating component
    await tick();
    expect(getOrgMock).toHaveBeenCalledWith(
      '/organizations/org-slug/',
      expect.anything()
    );

    expect(wrapper.state('loading')).toBe(false);
    expect(wrapper.state('error')).toBe(null);
    expect(wrapper.state('organization')).toEqual(org);

    expect(TeamStore.loadInitialData).toHaveBeenCalledWith(org.teams);
    expect(ProjectsStore.loadInitialData).toHaveBeenCalledWith(org.projects);
    expect(OrganizationActionCreator.fetchOrganizationDetails).toHaveBeenCalledWith(
      api,
      'org-slug',
      true,
      true
    );
  });

  it('fetches new org when router params change', async function () {
    wrapper = createWrapper();
    await tick();
    await tick();
    const mock = MockApiClient.addMockResponse({
      url: '/organizations/new-slug/',
      body: org,
    });
    wrapper.setProps({params: {orgId: 'new-slug'}});
    // await fetching new org
    await tick();
    wrapper.update();

    expect(mock).toHaveBeenLastCalledWith('/organizations/new-slug/', expect.anything());
  });

  it('shows loading error for non-superusers on 403s', async function () {
    getOrgMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/',
      statusCode: 403,
    });
    console.error = jest.fn(); // eslint-disable-line no-console
    wrapper = createWrapper();

    // await dispatching action
    await tick();
    // await resolving api, and updating component
    await tick();
    await tick();
    wrapper.update();
    expect(wrapper.find('LoadingError')).toHaveLength(1);
    console.error.mockRestore(); // eslint-disable-line no-console
  });

  it('opens sudo modal for superusers on 403s', async function () {
    ConfigStore.get.mockImplementation(() => ({
      isSuperuser: true,
    }));
    getOrgMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/',
      statusCode: 403,
    });
    wrapper = createWrapper();
    // await dispatching action
    await tick();
    // await resolving api, and updating component
    await tick();
    await tick();
    wrapper.update();

    expect(openSudo).toHaveBeenCalled();
  });

  it('uses last organization from ConfigStore', async function () {
    getOrgMock = MockApiClient.addMockResponse({
      url: '/organizations/lastOrganization/',
      body: org,
    });
    // mocking `.get('lastOrganization')`
    ConfigStore.get.mockImplementation(() => 'lastOrganization');
    wrapper = createWrapper({useLastOrganization: true, params: {}});
    // await dispatching action
    await tick();
    // await dispatching the action to org store
    await tick();
    expect(getOrgMock).toHaveBeenLastCalledWith(
      '/organizations/lastOrganization/',
      expect.anything()
    );
  });

  it('uses last organization from `organizations` prop', async function () {
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
      params: {orgId: ''},
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

    await tick(); // action to start fetch org
    await tick(); // action after successfully fetching org
    wrapper.update();
    expect(wrapper.find('LoadingIndicator')).toHaveLength(0);

    expect(getOrgMock).toHaveBeenLastCalledWith('/organizations/foo/', expect.anything());
  });

  it('uses last organization when no orgId in URL - and fetches org details once', async function () {
    ConfigStore.get.mockImplementation(() => 'my-last-org');
    getOrgMock = MockApiClient.addMockResponse({
      url: '/organizations/my-last-org/',
      body: TestStubs.Organization({slug: 'my-last-org'}),
    });

    wrapper = createWrapper({
      params: {},
      useLastOrganization: true,
      organizations: [],
    });
    // await dispatching action
    await tick();
    // await resolving api, and updating component
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

  it('fetches org details only once if organizations loading store changes', async function () {
    wrapper = createWrapper({
      params: {orgId: 'org-slug'},
      organizationsLoading: true,
      organizations: [],
    });
    // await dispatching action
    await tick();
    // await resolving api, and updating component
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
});
