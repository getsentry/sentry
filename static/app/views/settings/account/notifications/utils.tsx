import {Organization, Project} from 'app/types';

// Which fine tuning parts are grouped by project
export const isGroupedByProject = (type: string) =>
  ['alerts', 'email', 'workflow'].includes(type);

export const groupByOrganization = (projects: Project[]) => {
  return projects.reduce<
    Record<string, {organization: Organization; projects: Project[]}>
  >((acc, project) => {
    const orgSlug = project.organization.slug;
    if (acc.hasOwnProperty(orgSlug)) {
      acc[orgSlug].projects.push(project);
    } else {
      acc[orgSlug] = {
        organization: project.organization,
        projects: [project],
      };
    }
    return acc;
  }, {});
};
