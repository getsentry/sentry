import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {openSudo} from 'sentry/actionCreators/modal';
import * as OrganizationActionCreator from 'sentry/actionCreators/organization';
import ConfigStore from 'sentry/stores/configStore';
import OrganizationStore from 'sentry/stores/organizationStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import TeamStore from 'sentry/stores/teamStore';
import useOrganization from 'sentry/utils/useOrganization';
import {OrganizationLegacyContext} from 'sentry/views/organizationContextContainer';

jest.mock('sentry/stores/configStore', () => ({
  get: jest.fn(),
}));
jest.mock('sentry/actionCreators/modal', () => ({
  openSudo: jest.fn(),
}));

describe('OrganizationContextContainer', function () {
  const org = TestStubs.Organization();
  const teams = [TestStubs.Team()];
  const projects = [TestStubs.Project()];

  const api = new MockApiClient();
  let getOrgMock;
  let getProjectsMock;
  let getTeamsMock;

  function DisplayOrg() {
    const contextOrg = useOrganization();

    return <div>{contextOrg.slug}</div>;
  }

  function makeComponent(props) {
    return (
      <OrganizationLegacyContext
        api={api}
        params={{orgId: 'org-slug'}}
        location={{query: {}}}
        routes={[]}
        {...props}
      >
        <DisplayOrg />
      </OrganizationLegacyContext>
    );
  }

  function renderComponent(props) {
    return render(makeComponent(props));
  }

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
    OrganizationStore.reset();

    TeamStore.loadInitialData.mockRestore();
    ProjectsStore.loadInitialData.mockRestore();
    ConfigStore.get.mockRestore();
    OrganizationActionCreator.fetchOrganizationDetails.mockRestore();
  });

  it('renders and fetches org, projects, and teams', async function () {
    renderComponent();

    await waitFor(() => expect(getOrgMock).toHaveBeenCalled());
    expect(getProjectsMock).toHaveBeenCalled();
    expect(getTeamsMock).toHaveBeenCalled();

    expect(screen.queryByRole('loading-indicator')).not.toBeInTheDocument();
    expect(screen.getByText(org.slug)).toBeInTheDocument();
    expect(
      screen.queryByText('The organization you were looking for was not found.')
    ).not.toBeInTheDocument();

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

    const {rerender} = renderComponent();
    expect(await screen.findByText(org.slug)).toBeInTheDocument();

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

    // Re-render with new org slug
    rerender(makeComponent({params: {orgId: newOrg.slug}}));

    // Loads new org
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();

    // Renders new org
    expect(await screen.findByText(newOrg.slug)).toBeInTheDocument();

    expect(mock).toHaveBeenLastCalledWith('/organizations/new-slug/', expect.anything());
    expect(projectsMock).toHaveBeenCalled();
    expect(teamsMock).toHaveBeenCalled();
  });

  it('shows loading error for non-superusers on 403s', async function () {
    getOrgMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/',
      statusCode: 403,
    });
    jest.spyOn(console, 'error').mockImplementation(jest.fn()); // eslint-disable-line no-console
    renderComponent();

    expect(
      await screen.findByText('There was an error loading data.')
    ).toBeInTheDocument();

    // eslint-disable-next-line no-console
    expect(console.error).toHaveBeenCalled();
    // eslint-disable-next-line no-console
    console.error.mockRestore();
  });

  it('opens sudo modal for superusers on 403s', async function () {
    ConfigStore.get.mockImplementation(() => ({
      isSuperuser: true,
    }));
    getOrgMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/',
      statusCode: 403,
    });

    renderComponent();

    await waitFor(() => expect(openSudo).toHaveBeenCalled());
  });

  it('uses last organization from ConfigStore', function () {
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
    renderComponent({useLastOrganization: true, params: {}});

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

    const {rerender} = renderComponent({
      params: {orgId: ''},
      useLastOrganization: true,
      organizationsLoading: true,
      organizations: [],
    });

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();

    rerender(
      makeComponent({
        params: {orgId: ''},
        useLastOrganization: true,
        organizationsLoading: false,
        organizations: [
          TestStubs.Organization({slug: 'foo'}),
          TestStubs.Organization({slug: 'bar'}),
        ],
      })
    );

    expect(await screen.findByText(org.slug)).toBeInTheDocument();

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

    const {rerender} = renderComponent({
      params: {},
      useLastOrganization: true,
      organizations: [],
    });

    expect(await screen.findByText('my-last-org')).toBeInTheDocument();
    expect(getOrgMock).toHaveBeenCalledTimes(1);

    // Simulate OrganizationsStore being loaded *after* `OrganizationContext` finishes
    // org details fetch
    rerender(
      makeComponent({
        params: {},
        useLastOrganization: true,
        organizationsLoading: false,
        organizations: [
          TestStubs.Organization({slug: 'foo'}),
          TestStubs.Organization({slug: 'bar'}),
        ],
      })
    );

    expect(getOrgMock).toHaveBeenCalledTimes(1);
    expect(getProjectsMock).toHaveBeenCalledTimes(1);
    expect(getTeamsMock).toHaveBeenCalledTimes(1);
  });

  it('fetches org details only once if organizations loading store changes', async function () {
    const {rerender} = renderComponent({
      params: {orgId: 'org-slug'},
      organizationsLoading: true,
      organizations: [],
    });

    expect(await screen.findByText(org.slug)).toBeInTheDocument();
    expect(getOrgMock).toHaveBeenCalledTimes(1);

    // Simulate OrganizationsStore being loaded *after* `OrganizationContext` finishes
    // org details fetch
    rerender(
      makeComponent({
        params: {orgId: 'org-slug'},
        organizationsLoading: false,
        organizations: [
          TestStubs.Organization({slug: 'foo'}),
          TestStubs.Organization({slug: 'bar'}),
        ],
      })
    );

    expect(getOrgMock).toHaveBeenCalledTimes(1);
    expect(getProjectsMock).toHaveBeenCalledTimes(1);
    expect(getTeamsMock).toHaveBeenCalledTimes(1);
  });
});
