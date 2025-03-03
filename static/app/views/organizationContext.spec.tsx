import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {TeamFixture} from 'sentry-fixture/team';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import * as orgsActionCreators from 'sentry/actionCreators/organizations';
import {openSudo} from 'sentry/actionCreators/sudoModal';
import ConfigStore from 'sentry/stores/configStore';
import OrganizationStore from 'sentry/stores/organizationStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import TeamStore from 'sentry/stores/teamStore';
import type {Organization} from 'sentry/types/organization';
import useOrganization from 'sentry/utils/useOrganization';

import {OrganizationContextProvider} from './organizationContext';

jest.mock('sentry/actionCreators/sudoModal');

describe('OrganizationContext', function () {
  let getOrgMock: jest.Mock;
  let getProjectsMock: jest.Mock;
  let getTeamsMock: jest.Mock;

  const organization = OrganizationFixture();
  const project = ProjectFixture();
  const team = TeamFixture();

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

    TeamStore.reset();
    ProjectsStore.reset();
    ConfigStore.init();
    OrganizationStore.reset();

    jest.spyOn(console, 'error').mockImplementation(jest.fn());
  });

  afterEach(function () {
    // eslint-disable-next-line no-console
    jest.mocked(console.error).mockRestore();
  });

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
        <OrganizationName />
      </OrganizationContextProvider>
    );

    expect(await screen.findByText(organization.slug)).toBeInTheDocument();
    expect(getOrgMock).toHaveBeenCalled();
    expect(getProjectsMock).toHaveBeenCalled();
    expect(getTeamsMock).toHaveBeenCalled();
  });

  it('fetches new org when router params change', async function () {
    // First render with org-slug
    const {router: testRouter} = render(
      <OrganizationContextProvider>
        <OrganizationName />
      </OrganizationContextProvider>,
      {
        disableRouterMocks: true,
        initialRouterConfig: {
          route: '/organizations/:orgId/',
          location: {
            pathname: `/organizations/${organization.slug}/`,
          },
        },
      }
    );

    expect(await screen.findByText(organization.slug)).toBeInTheDocument();
    expect(JSON.stringify(OrganizationStore.getState().organization)).toEqual(
      JSON.stringify(organization)
    );

    const anotherOrg = OrganizationFixture({slug: 'another-org'});

    const {orgMock, projectMock, teamMock} = setupOrgMocks(anotherOrg);

    const switchOrganization = jest.spyOn(orgsActionCreators, 'switchOrganization');

    // re-render with another-org
    testRouter.navigate(`/organizations/${anotherOrg.slug}/`);

    expect(await screen.findByText(anotherOrg.slug)).toBeInTheDocument();
    expect(orgMock).toHaveBeenCalled();
    expect(projectMock).toHaveBeenCalled();
    expect(teamMock).toHaveBeenCalled();
    expect(switchOrganization).toHaveBeenCalled();
    expect(JSON.stringify(OrganizationStore.getState().organization)).toEqual(
      JSON.stringify(anotherOrg)
    );
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
      <OrganizationContextProvider>
        <OrganizationName />
      </OrganizationContextProvider>,
      {
        disableRouterMocks: true,
        initialRouterConfig: {
          route: '/organizations/',
          location: {
            pathname: `/organizations/`,
          },
        },
      }
    );

    expect(await screen.findByText(configStoreOrg.slug)).toBeInTheDocument();
    expect(orgMock).toHaveBeenCalled();
    expect(projectMock).toHaveBeenCalled();
    expect(teamMock).toHaveBeenCalled();
  });
});
