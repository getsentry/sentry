import React from 'react';
import {mount} from 'sentry-test/enzyme';

import TeamActions from 'app/actions/teamActions';
import ProjectActions from 'app/actions/projectActions';
import withTeamsForUser from 'app/utils/withTeamsForUser';

describe('withUserTeams HoC', function() {
  const api = new MockApiClient();
  const organization = TestStubs.Organization();
  delete organization.projects;
  delete organization.teams;

  beforeEach(function() {
    MockApiClient.clearMockResponses();
    jest.spyOn(ProjectActions, 'loadProjects');
    jest.spyOn(TeamActions, 'loadTeams');
  });

  it('forwards errors', async function() {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/user-teams/`,
      statusCode: 400,
    });
    const MyComponent = () => null;
    const Container = withTeamsForUser(MyComponent);
    const wrapper = mount(<Container organization={organization} api={api} />);
    await tick();
    expect(
      wrapper
        .update()
        .find('MyComponent')
        .prop('error')
    ).not.toBeNull();
  });

  it('fetches teams and loads stores', async function() {
    const mockProjectA = TestStubs.Project({slug: 'a', id: '1'});
    const mockProjectB = TestStubs.Project({slug: 'b', id: '2'});
    const mockTeams = [
      {
        slug: 'sentry',
        projects: [mockProjectB],
      },
      {
        slug: 'captainplanet',
        projects: [mockProjectA, mockProjectB],
      },
    ];

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/user-teams/`,
      body: mockTeams,
    });

    const MyComponent = () => null;
    const Container = withTeamsForUser(MyComponent);
    const wrapper = mount(<Container organization={organization} api={api} />);
    await tick();
    expect(
      wrapper
        .update()
        .find('MyComponent')
        .prop('teams')
    ).toEqual(mockTeams);
  });

  it('does not fetch teams if information is in organization', async function() {
    const mockTeam = TestStubs.Team();
    const mockProjects = [TestStubs.Project({teams: [mockTeam]})];
    const mockOrg = TestStubs.Organization({teams: [mockTeam], projects: mockProjects});

    const getTeamsMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/user-teams/`,
      body: [mockTeam],
    });

    const MyComponent = () => null;
    const Container = withTeamsForUser(MyComponent);
    const wrapper = mount(<Container organization={mockOrg} api={api} />);
    await tick();

    const expectedTeams = [{...mockTeam, projects: mockProjects}];

    expect(
      wrapper
        .update()
        .find('MyComponent')
        .prop('teams')
    ).toEqual(expectedTeams);

    // ensure no request was made to get teams
    expect(getTeamsMock).not.toHaveBeenCalled();
  });
});
