import {Project as ProjectFixture} from 'sentry-fixture/project';
import {Team} from 'sentry-fixture/team';

import getProjectsByTeams from 'sentry/utils/getProjectsByTeams';

describe('getProjectsByTeams', function () {
  let projectsByTeams;
  beforeEach(function () {
    const team1 = Team({id: '1', slug: 'team1'});
    const team2 = Team({id: '2', slug: 'team2'});
    const teams = [team1, team2];
    const projects = [
      ProjectFixture({slug: 'project1', teams}),
      ProjectFixture({slug: 'project2'}),
    ];
    projectsByTeams = getProjectsByTeams(teams, projects);
  });

  it('lists projects by team', function () {
    expect(Object.keys(projectsByTeams.projectsByTeam)).toEqual(['team1', 'team2']);
  });

  it('lists teamless projecrts', function () {
    expect(projectsByTeams.teamlessProjects).toHaveLength(1);
  });
});
