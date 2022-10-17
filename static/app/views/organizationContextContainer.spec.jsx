import {mountWithTheme} from 'sentry-test/enzyme';

import {openSudo} from 'sentry/actionCreators/modal';
import * as OrganizationActionCreator from 'sentry/actionCreators/organization';
import ConfigStore from 'sentry/stores/configStore';
import OrganizationStore from 'sentry/stores/organizationStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import TeamStore from 'sentry/stores/teamStore';
import {OrganizationLegacyContext} from 'sentry/views/organizationContextContainer';

jest.mock('sentry/stores/configStore', () => ({
  get: jest.fn(),
}));
jest.mock('sentry/actionCreators/modal', () => ({
  openSudo: jest.fn(),
}));

describe('OrganizationContextContainer', function () {
  let wrapper;
  const org = TestStubs.Organization();
  const teams = [TestStubs.Team()];
  const projects = [TestStubs.Project()];

  const api = new MockApiClient();
  let getOrgMock;
  let getProjectsMock;
  let getTeamsMock;

  const createWrapper = props => {
    wrapper = mountWithTheme(
      <OrganizationLegacyContext
        api={api}
        params={{orgId: 'org-slug'}}
        location={{query: {}}}
        routes={[]}
        {...props}
      >
        <div />
      </OrganizationLegacyContext>
    );
    return wrapper;
  };

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    getOrgMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/',
      body: org,
    });
    getProjectsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: projects,
    });
    getTeamsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/teams/',
      body: teams,
    });

    jest.spyOn(TeamStore, 'loadInitialData');
    jest.spyOn(ProjectsStore, 'loadInitialData');
    jest.spyOn(OrganizationActionCreator, 'fetchOrganizationDetails');
  });

  afterEach(function () {
    wrapper.unmount();
    OrganizationStore.reset();

    TeamStore.loadInitialData.mockRestore();
    ProjectsStore.loadInitialData.mockRestore();
    ConfigStore.get.mockRestore();
    OrganizationActionCreator.fetchOrganizationDetails.mockRestore();
  });

  it('renders and fetches org, projects, and teams', async function () {
    wrapper = createWrapper();
    // await dispatching the action to org store
    await tick();
    // await resolving the api promise from action creator and updating component
    await tick();
    expect(getOrgMock).toHaveBeenCalled();
    expect(getProjectsMock).toHaveBeenCalled();
    expect(getTeamsMock).toHaveBeenCalled();

    expect(wrapper.state('loading')).toBe(false);
    expect(wrapper.state('error')).toBe(null);
    expect(wrapper.state('organization')).toEqual(org);

    expect(TeamStore.loadInitialData).toHaveBeenCalledWith(teams);
    expect(ProjectsStore.loadInitialData).toHaveBeenCalledWith(projects);
    expect(OrganizationActionCreator.fetchOrganizationDetails).toHaveBeenCalledWith(
      api,
      'org-slug',
      true,
      true
    );
  });

  it('fetches new org when router params change', async function () {
    const newOrg = TestStubs.Organization({slug: 'new-slug'});

    wrapper = createWrapper();
    const instance = wrapper.instance();
    jest.spyOn(instance, 'render');

    // initial render
    await tick();
    await tick();
    expect(instance.state.organization).toEqual(org);
    expect(instance.render).toHaveBeenCalledTimes(1);

    const mock = MockApiClient.addMockResponse({
      url: '/organizations/new-slug/',
      body: newOrg,
    });
    const projectsMock = MockApiClient.addMockResponse({
      url: '/organizations/new-slug/projects/',
      body: projects,
    });
    const teamsMock = MockApiClient.addMockResponse({
      url: '/organizations/new-slug/teams/',
      body: teams,
    });

    wrapper.setProps({params: {orgId: newOrg.slug}}, () => {
      // state should be reset based on props
      expect(instance.state.organization).toEqual(null);
      expect(instance.render).toHaveBeenCalledTimes(2);
    });

    // await fetching new org
    await tick();
    await tick();
    wrapper.update();

    expect(mock).toHaveBeenLastCalledWith('/organizations/new-slug/', expect.anything());
    expect(projectsMock).toHaveBeenCalled();
    expect(teamsMock).toHaveBeenCalled();

    expect(wrapper.state('loading')).toBe(false);
    expect(wrapper.state('error')).toBe(null);
    expect(wrapper.state('organization')).toEqual(newOrg);
  });

  it('shows loading error for non-superusers on 403s', async function () {
    getOrgMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/',
      statusCode: 403,
    });
    jest.spyOn(console, 'error').mockImplementation(jest.fn()); // eslint-disable-line no-console
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
      url: '/organizations/last-org/',
      body: org,
    });
    MockApiClient.addMockResponse({
      url: '/organizations/last-org/projects/',
      body: projects,
    });
    MockApiClient.addMockResponse({
      url: '/organizations/last-org/teams/',
      body: teams,
    });

    // mocking `.get('lastOrganization')`
    ConfigStore.get.mockImplementation(() => 'last-org');
    wrapper = createWrapper({useLastOrganization: true, params: {}});
    // await dispatching action
    await tick();
    // await dispatching the action to org store
    await tick();
    expect(getOrgMock).toHaveBeenLastCalledWith(
      '/organizations/last-org/',
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
    getProjectsMock = MockApiClient.addMockResponse({
      url: '/organizations/foo/projects/',
      body: projects,
    });
    getTeamsMock = MockApiClient.addMockResponse({
      url: '/organizations/foo/teams/',
      body: teams,
    });

    ConfigStore.get.mockImplementation(() => '');

    wrapper = createWrapper({
      useLastOrganization: true,
      params: {orgId: ''},
      organizationsLoading: true,
      organizations: [],
    });

    expect(wrapper.find('LoadingTriangle')).toHaveLength(1);

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
    expect(wrapper.find('LoadingTriangle')).toHaveLength(0);

    expect(getOrgMock).toHaveBeenCalled();
    expect(getProjectsMock).toHaveBeenCalled();
    expect(getTeamsMock).toHaveBeenCalled();
  });

  it('uses last organization when no orgId in URL - and fetches org details once', async function () {
    ConfigStore.get.mockImplementation(() => 'my-last-org');
    getOrgMock = MockApiClient.addMockResponse({
      url: '/organizations/my-last-org/',
      body: TestStubs.Organization({slug: 'my-last-org'}),
    });
    getProjectsMock = MockApiClient.addMockResponse({
      url: '/organizations/my-last-org/projects/',
      body: projects,
    });
    getTeamsMock = MockApiClient.addMockResponse({
      url: '/organizations/my-last-org/teams/',
      body: teams,
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
    expect(wrapper.find('LoadingTriangle')).toHaveLength(0);
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
    expect(getProjectsMock).toHaveBeenCalledTimes(1);
    expect(getTeamsMock).toHaveBeenCalledTimes(1);
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
    expect(wrapper.find('LoadingTriangle')).toHaveLength(0);
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
    expect(getProjectsMock).toHaveBeenCalledTimes(1);
    expect(getTeamsMock).toHaveBeenCalledTimes(1);
  });
});
