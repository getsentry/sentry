import * as OrganizationsActionCreator from 'app/actionCreators/organizations';
import {fetchOrganizationDetails} from 'app/actionCreators/organization';
import TeamStore from 'app/stores/teamStore';
import ProjectsStore from 'app/stores/projectsStore';
import OrganizationActions from 'app/actions/organizationActions';

describe('OrganizationActionCreator', function () {
  const detailedOrg = TestStubs.Organization({
    teams: [TestStubs.Team()],
    projects: [TestStubs.Project()],
  });

  const lightOrg = TestStubs.Organization();
  delete lightOrg.teams;
  delete lightOrg.projects;

  const api = new MockApiClient();

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    jest.spyOn(TeamStore, 'loadInitialData');
    jest.spyOn(ProjectsStore, 'loadInitialData');
    jest.spyOn(OrganizationActions, 'fetchOrg');
    jest.spyOn(OrganizationActions, 'update');
    jest.spyOn(OrganizationActions, 'fetchOrgError');
    jest.spyOn(OrganizationsActionCreator, 'setActiveOrganization');
  });

  afterEach(function () {
    jest.restoreAllMocks();
    MockApiClient.clearMockResponses();
  });

  it('fetches heavyweight organization details', async function () {
    const getOrgMock = MockApiClient.addMockResponse({
      url: `/organizations/${detailedOrg.slug}/`,
      body: detailedOrg,
    });

    fetchOrganizationDetails(api, detailedOrg.slug, true);
    await tick();
    expect(OrganizationActions.fetchOrg).toHaveBeenCalled();

    expect(getOrgMock).toHaveBeenCalledWith(
      `/organizations/${detailedOrg.slug}/`,
      expect.anything()
    );
    expect(OrganizationActions.update).toHaveBeenCalledWith(detailedOrg, {replace: true});
    expect(OrganizationsActionCreator.setActiveOrganization).toHaveBeenCalled();

    expect(TeamStore.loadInitialData).toHaveBeenCalledWith(detailedOrg.teams);
    expect(ProjectsStore.loadInitialData).toHaveBeenCalledWith(detailedOrg.projects);
  });

  it('fetches lightweight organization details', async function () {
    const getOrgMock = MockApiClient.addMockResponse({
      url: `/organizations/${lightOrg.slug}/`,
      body: lightOrg,
    });
    const getProjectsMock = MockApiClient.addMockResponse({
      url: `/organizations/${lightOrg.slug}/projects/`,
      body: [],
    });
    const getTeamsMock = MockApiClient.addMockResponse({
      url: `/organizations/${lightOrg.slug}/teams/`,
      body: [],
    });

    fetchOrganizationDetails(api, lightOrg.slug, false);
    await tick();
    expect(OrganizationActions.fetchOrg).toHaveBeenCalled();

    expect(getOrgMock).toHaveBeenCalledWith(
      `/organizations/${lightOrg.slug}/`,
      expect.anything()
    );
    expect(getProjectsMock).toHaveBeenCalledWith(
      `/organizations/${lightOrg.slug}/projects/`,
      expect.anything()
    );
    expect(getTeamsMock).toHaveBeenCalledWith(
      `/organizations/${lightOrg.slug}/teams/`,
      expect.anything()
    );
    expect(OrganizationActions.update).toHaveBeenCalledWith(lightOrg, {replace: true});
    expect(OrganizationsActionCreator.setActiveOrganization).toHaveBeenCalled();

    expect(TeamStore.loadInitialData).not.toHaveBeenCalled();
    expect(ProjectsStore.loadInitialData).not.toHaveBeenCalled();
  });

  it('silently fetches organization details', async function () {
    const getOrgMock = MockApiClient.addMockResponse({
      url: `/organizations/${detailedOrg.slug}/`,
      body: detailedOrg,
    });

    fetchOrganizationDetails(api, detailedOrg.slug, true, true);
    await tick();
    expect(OrganizationActions.fetchOrg).not.toHaveBeenCalled();

    expect(getOrgMock).toHaveBeenCalledWith(
      `/organizations/${detailedOrg.slug}/`,
      expect.anything()
    );
    expect(OrganizationActions.update).toHaveBeenCalledWith(detailedOrg, {replace: true});
    expect(OrganizationsActionCreator.setActiveOrganization).toHaveBeenCalled();

    expect(TeamStore.loadInitialData).toHaveBeenCalledWith(detailedOrg.teams);
    expect(ProjectsStore.loadInitialData).toHaveBeenCalledWith(detailedOrg.projects);
  });

  it('errors out correctly', async function () {
    const getOrgMock = MockApiClient.addMockResponse({
      url: `/organizations/${detailedOrg.slug}/`,
      statusCode: 400,
    });

    fetchOrganizationDetails(api, detailedOrg.slug, true);
    await tick();
    expect(OrganizationActions.fetchOrg).toHaveBeenCalled();
    expect(getOrgMock).toHaveBeenCalledWith(
      `/organizations/${detailedOrg.slug}/`,
      expect.anything()
    );
    expect(OrganizationActions.fetchOrgError).toHaveBeenCalled();
  });
});
