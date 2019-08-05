import {Project, Team} from 'app/types';

export default function getProjectsByTeams(
  teams: Team[],
  projects: Project[],
  isSuperuser: boolean = false
): {projectsByTeam: {[teamSlug: string]: Project[]}; teamlessProjects: Project[]} {
  const projectsByTeam = {};
  const teamlessProjects: Project[] = [];
  let usersTeams = new Set(teams.filter(team => team.isMember).map(team => team.slug));

  if (usersTeams.size === 0 && isSuperuser) {
    usersTeams = new Set(teams.map(team => team.slug));
  }

  projects.forEach(project => {
    if (!project.teams.length && project.isMember) {
      teamlessProjects.push(project);
    } else {
      project.teams.forEach(team => {
        if (!usersTeams.has(team.slug)) {
          return;
        }
        if (!projectsByTeam.hasOwnProperty(team.slug)) {
          projectsByTeam[team.slug] = [];
        }
        projectsByTeam[team.slug].push(project);
      });
    }
  });

  return {projectsByTeam, teamlessProjects};
}
