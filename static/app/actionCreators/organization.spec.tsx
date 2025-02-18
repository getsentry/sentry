import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {TeamFixture} from 'sentry-fixture/team';

import {fetchOrganizationDetails} from 'sentry/actionCreators/organization';
import * as OrganizationsActionCreator from 'sentry/actionCreators/organizations';
import OrganizationStore from 'sentry/stores/organizationStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import TeamStore from 'sentry/stores/teamStore';

describe('OrganizationActionCreator', function () {
  const org = OrganizationFixture();

  const teams = [TeamFixture()];
  const projects = [ProjectFixture()];

  const api = new MockApiClient();

  beforeEach(function () {
    jest.spyOn(TeamStore, 'loadInitialData');
    jest.spyOn(ProjectsStore, 'loadInitialData');
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

    fetchOrganizationDetails(api, org.slug);
    await tick();

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

    fetchOrganizationDetails(api, org.slug);
    await tick();

    expect(getOrgMock).toHaveBeenCalledWith(
      `/organizations/${org.slug}/`,
      expect.anything()
    );
    expect(OrganizationStore.onFetchOrgError).toHaveBeenCalled();
  });
});
