import {Project} from 'fixtures/js-stubs/project';
import {Team} from 'fixtures/js-stubs/team';

import getProjectsByTeams from 'sentry/utils/getProjectsByTeams';

describe('getProjectsByTeams', function () {
  let projectsByTeams;
  beforeEach(function () {
    const team1 = Team({id: '1', slug: 'team1'});
    const team2 = Team({id: '2', slug: 'team2'});
    const teams = [team1, team2];
    const projects = [Project({slug: 'project1', teams}), Project({slug: 'project2'})];
    projectsByTeams = getProjectsByTeams(teams, projects);
  });

  it('lists projects by team', function () {
    expect(Object.keys(projectsByTeams.projectsByTeam)).toEqual(['team1', 'team2']);
  });

  it('lists teamless projecrts', function () {
    expect(projectsByTeams.teamlessProjects).toHaveLength(1);
  });
});
