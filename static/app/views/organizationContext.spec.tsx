import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {RouterFixture} from 'sentry-fixture/routerFixture';
import {TeamFixture} from 'sentry-fixture/team';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import * as orgsActionCreators from 'sentry/actionCreators/organizations';
import {openSudo} from 'sentry/actionCreators/sudoModal';
import ConfigStore from 'sentry/stores/configStore';
import OrganizationStore from 'sentry/stores/organizationStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import TeamStore from 'sentry/stores/teamStore';
import type {RouteContextInterface} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import useOrganization from 'sentry/utils/useOrganization';

import {OrganizationContextProvider, useEnsureOrganization} from './organizationContext';
import {TestRouteContext} from './routeContext';

jest.mock('sentry/actionCreators/sudoModal');

describe('OrganizationContext', function () {
  let getOrgMock: jest.Mock;
  let getProjectsMock: jest.Mock;
  let getTeamsMock: jest.Mock;

  const organization = OrganizationFixture();
  const project = ProjectFixture();
  const team = TeamFixture();

  const router: RouteContextInterface = {
    router: RouterFixture(),
    location: LocationFixture(),
    routes: [],
    params: {orgId: organization.slug},
  };

  function setupOrgMocks(org: Organization) {
    const orgMock = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/`,
      body: org,
    });
    const projectMock = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/projects/`,
      body: [project],
    });
    const teamMock = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/teams/`,
      body: [team],
    });

    return {orgMock, projectMock, teamMock};
  }

  beforeEach(function () {
    MockApiClient.clearMockResponses();

    const {orgMock, projectMock, teamMock} = setupOrgMocks(organization);
    getOrgMock = orgMock;
    getProjectsMock = projectMock;
    getTeamsMock = teamMock;

    jest.spyOn(TeamStore, 'loadInitialData');
    jest.spyOn(ProjectsStore, 'loadInitialData');

    ConfigStore.init();
    OrganizationStore.reset();

    jest.spyOn(console, 'error').mockImplementation(jest.fn());
  });

  afterEach(function () {
    // eslint-disable-next-line no-console
    jest.mocked(console.error).mockRestore();
  });

  function OrganizationLoaderStub() {
    useEnsureOrganization();
    return null;
  }

  /**
   * Used to test that the organization context is propegated
   */
  function OrganizationName() {
    const org = useOrganization({allowNull: true});

    return <div>{org?.slug ?? 'no-org'}</div>;
  }

  it('fetches org, projects, teams, and provides organization context', async function () {
    render(
      <OrganizationContextProvider>
        <OrganizationLoaderStub />
        <OrganizationName />
      </OrganizationContextProvider>
    );

    expect(await screen.findByText(organization.slug)).toBeInTheDocument();
    expect(getOrgMock).toHaveBeenCalled();
    expect(getProjectsMock).toHaveBeenCalled();
    expect(getTeamsMock).toHaveBeenCalled();
  });

  it('does not fetch if organization is already set', async function () {
    OrganizationStore.onUpdate(organization);

    render(
      <OrganizationContextProvider>
        <OrganizationLoaderStub />
        <OrganizationName />
      </OrganizationContextProvider>
    );

    expect(await screen.findByText(organization.slug)).toBeInTheDocument();
    expect(getOrgMock).not.toHaveBeenCalled();
  });

  it('fetches new org when router params change', async function () {
    // First render with org-slug
    const {rerender} = render(
      <TestRouteContext.Provider value={router}>
        <OrganizationContextProvider>
          <OrganizationLoaderStub />
          <OrganizationName />
        </OrganizationContextProvider>
      </TestRouteContext.Provider>
    );

    expect(await screen.findByText(organization.slug)).toBeInTheDocument();
    const anotherOrg = OrganizationFixture({slug: 'another-org'});

    const {orgMock, projectMock, teamMock} = setupOrgMocks(anotherOrg);

    const switchOrganization = jest.spyOn(orgsActionCreators, 'switchOrganization');

    // re-render with another-org
    rerender(
      <TestRouteContext.Provider value={{...router, params: {orgId: 'another-org'}}}>
        <OrganizationContextProvider>
          <OrganizationLoaderStub />
          <OrganizationName />
        </OrganizationContextProvider>
      </TestRouteContext.Provider>
    );

    expect(await screen.findByText(anotherOrg.slug)).toBeInTheDocument();
    expect(orgMock).toHaveBeenCalled();
    expect(projectMock).toHaveBeenCalled();
    expect(teamMock).toHaveBeenCalled();
    expect(switchOrganization).toHaveBeenCalled();
  });

  it('opens sudo modal for superusers for nonmember org with active staff', async function () {
    ConfigStore.set('user', UserFixture({isSuperuser: true, isStaff: true}));
    organization.access = [];

    getOrgMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/`,
      body: organization,
    });

    render(
      <OrganizationContextProvider>
        <OrganizationLoaderStub />
        <OrganizationName />
      </OrganizationContextProvider>
    );

    await waitFor(() => !OrganizationStore.getState().loading);

    await waitFor(() => expect(openSudo).toHaveBeenCalled());
  });

  it('opens sudo modal for superusers on 403s', async function () {
    ConfigStore.set('user', UserFixture({isSuperuser: true}));

    getOrgMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/',
      statusCode: 403,
    });

    render(
      <OrganizationContextProvider>
        <OrganizationLoaderStub />
        <OrganizationName />
      </OrganizationContextProvider>
    );

    await waitFor(() => !OrganizationStore.getState().loading);

    // eslint-disable-next-line no-console
    await waitFor(() => expect(console.error).toHaveBeenCalled());
    expect(openSudo).toHaveBeenCalled();
  });

  /**
   * This test will rarely happen since most configurations are now using customer domains
   */
  it('uses last organization slug from ConfigStore', async function () {
    const configStoreOrg = OrganizationFixture({slug: 'config-store-org'});

    ConfigStore.set('lastOrganization', configStoreOrg.slug);

    const {orgMock, projectMock, teamMock} = setupOrgMocks(configStoreOrg);

    // orgId is not present in the router.
    render(
      <TestRouteContext.Provider value={{...router, params: {}}}>
        <OrganizationContextProvider>
          <OrganizationLoaderStub />
          <OrganizationName />
        </OrganizationContextProvider>
      </TestRouteContext.Provider>
    );

    expect(await screen.findByText(configStoreOrg.slug)).toBeInTheDocument();
    expect(orgMock).toHaveBeenCalled();
    expect(projectMock).toHaveBeenCalled();
    expect(teamMock).toHaveBeenCalled();
  });
});
