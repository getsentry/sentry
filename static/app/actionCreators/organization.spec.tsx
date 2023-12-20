import {Organization} from 'sentry-fixture/organization';
import {Project as ProjectFixture} from 'sentry-fixture/project';
import {Team} from 'sentry-fixture/team';

import {fetchOrganizationDetails} from 'sentry/actionCreators/organization';
import * as OrganizationsActionCreator from 'sentry/actionCreators/organizations';
import OrganizationStore from 'sentry/stores/organizationStore';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import TeamStore from 'sentry/stores/teamStore';

describe('OrganizationActionCreator', function () {
  const org = Organization();

  const teams = [Team()];
  const projects = [ProjectFixture()];

  const api = new MockApiClient();

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    jest.spyOn(TeamStore, 'loadInitialData');
    jest.spyOn(TeamStore, 'reset');
    jest.spyOn(PageFiltersStore, 'onReset');
    jest.spyOn(ProjectsStore, 'loadInitialData');
    jest.spyOn(ProjectsStore, 'reset');
    jest.spyOn(OrganizationStore, 'reset');
    jest.spyOn(OrganizationStore, 'onUpdate');
    jest.spyOn(OrganizationStore, 'onFetchOrgError');
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

    expect(OrganizationStore.reset).toHaveBeenCalled();
    expect(PageFiltersStore.onReset).toHaveBeenCalled();
    expect(ProjectsStore.reset).toHaveBeenCalled();
    expect(TeamStore.reset).toHaveBeenCalled();

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
    expect(OrganizationStore.onUpdate).toHaveBeenCalledWith(org, {replace: true});
    expect(OrganizationsActionCreator.setActiveOrganization).toHaveBeenCalled();

    expect(TeamStore.loadInitialData).toHaveBeenCalledWith(teams);
    expect(ProjectsStore.loadInitialData).toHaveBeenCalledWith(projects);

    expect(OrganizationStore.get().organization).toEqual(org);
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

    expect(OrganizationStore.reset).not.toHaveBeenCalled();
    expect(PageFiltersStore.onReset).not.toHaveBeenCalled();
    expect(ProjectsStore.reset).not.toHaveBeenCalled();
    expect(TeamStore.reset).not.toHaveBeenCalled();

    expect(getOrgMock).toHaveBeenCalledWith(
      `/organizations/${org.slug}/`,
      expect.anything()
    );

    expect(OrganizationStore.onUpdate).toHaveBeenCalledWith(org, {replace: true});
    expect(OrganizationsActionCreator.setActiveOrganization).toHaveBeenCalled();

    expect(TeamStore.loadInitialData).toHaveBeenCalledWith(teams);
    expect(ProjectsStore.loadInitialData).toHaveBeenCalledWith(projects);
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

    expect(OrganizationStore.reset).toHaveBeenCalled();
    expect(PageFiltersStore.onReset).toHaveBeenCalled();
    expect(ProjectsStore.reset).toHaveBeenCalled();
    expect(TeamStore.reset).toHaveBeenCalled();
    expect(getOrgMock).toHaveBeenCalledWith(
      `/organizations/${org.slug}/`,
      expect.anything()
    );
    expect(OrganizationStore.onFetchOrgError).toHaveBeenCalled();
  });
});
