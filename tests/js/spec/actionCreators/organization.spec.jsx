import {fetchOrganizationDetails} from 'sentry/actionCreators/organization';
import * as OrganizationsActionCreator from 'sentry/actionCreators/organizations';
import OrganizationActions from 'sentry/actions/organizationActions';
import PageFiltersActions from 'sentry/actions/pageFiltersActions';
import ProjectActions from 'sentry/actions/projectActions';
import TeamActions from 'sentry/actions/teamActions';
import OrganizationStore from 'sentry/stores/organizationStore';

describe('OrganizationActionCreator', function () {
  const org = TestStubs.Organization();
  delete org.teams;
  delete org.projects;

  const teams = [TestStubs.Team()];
  const projects = [TestStubs.Project()];

  const api = new MockApiClient();

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    jest.spyOn(TeamActions, 'loadTeams');
    jest.spyOn(TeamActions, 'reset');
    jest.spyOn(PageFiltersActions, 'reset');
    jest.spyOn(ProjectActions, 'loadProjects');
    jest.spyOn(ProjectActions, 'reset');
    jest.spyOn(OrganizationActions, 'reset');
    jest.spyOn(OrganizationActions, 'update');
    jest.spyOn(OrganizationActions, 'fetchOrgError');
    jest.spyOn(OrganizationsActionCreator, 'setActiveOrganization');
  });

  afterEach(function () {
    jest.restoreAllMocks();
    MockApiClient.clearMockResponses();
  });

  it('fetches organization details', async function () {
    const getOrgMock = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/`,
      body: org,
    });
    const getProjectsMock = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/projects/`,
      body: projects,
    });
    const getTeamsMock = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/teams/`,
      body: teams,
    });

    fetchOrganizationDetails(api, org.slug, false);
    await tick();
    await tick();
    expect(OrganizationActions.reset).toHaveBeenCalled();
    expect(PageFiltersActions.reset).toHaveBeenCalled();
    expect(ProjectActions.reset).toHaveBeenCalled();
    expect(TeamActions.reset).toHaveBeenCalled();

    expect(getOrgMock).toHaveBeenCalledWith(
      `/organizations/${org.slug}/`,
      expect.anything()
    );
    expect(getProjectsMock).toHaveBeenCalledWith(
      `/organizations/${org.slug}/projects/`,
      expect.anything()
    );
    expect(getTeamsMock).toHaveBeenCalledWith(
      `/organizations/${org.slug}/teams/`,
      expect.anything()
    );
    expect(OrganizationActions.update).toHaveBeenCalledWith(org, {replace: true});
    expect(OrganizationsActionCreator.setActiveOrganization).toHaveBeenCalled();

    expect(TeamActions.loadTeams).toHaveBeenCalledWith(teams);
    expect(ProjectActions.loadProjects).toHaveBeenCalledWith(projects);

    expect(OrganizationStore.organization).toEqual(org);
  });

  it('silently fetches organization details', async function () {
    const getOrgMock = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/`,
      body: org,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/projects/`,
      body: projects,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/teams/`,
      body: teams,
    });

    fetchOrganizationDetails(api, org.slug, true, true);
    await tick();
    expect(OrganizationActions.reset).not.toHaveBeenCalled();
    expect(PageFiltersActions.reset).not.toHaveBeenCalled();
    expect(ProjectActions.reset).not.toHaveBeenCalled();
    expect(TeamActions.reset).not.toHaveBeenCalled();

    expect(getOrgMock).toHaveBeenCalledWith(
      `/organizations/${org.slug}/`,
      expect.anything()
    );

    expect(OrganizationActions.update).toHaveBeenCalledWith(org, {replace: true});
    expect(OrganizationsActionCreator.setActiveOrganization).toHaveBeenCalled();

    expect(TeamActions.loadTeams).toHaveBeenCalledWith(teams);
    expect(ProjectActions.loadProjects).toHaveBeenCalledWith(projects);
  });

  it('errors out correctly', async function () {
    const getOrgMock = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/`,
      statusCode: 400,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/projects/`,
      body: projects,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/teams/`,
      body: teams,
    });

    fetchOrganizationDetails(api, org.slug, false);
    await tick();
    expect(OrganizationActions.reset).toHaveBeenCalled();
    expect(PageFiltersActions.reset).toHaveBeenCalled();
    expect(ProjectActions.reset).toHaveBeenCalled();
    expect(TeamActions.reset).toHaveBeenCalled();
    expect(getOrgMock).toHaveBeenCalledWith(
      `/organizations/${org.slug}/`,
      expect.anything()
    );
    expect(OrganizationActions.fetchOrgError).toHaveBeenCalled();
  });
});
