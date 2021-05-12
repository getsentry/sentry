import {Organization, Project} from 'app/types';

// Which fine tuning parts are grouped by project
export const isGroupedByProject = (type: string): boolean =>
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

export const getFallBackValue = (notificationType: string): string => {
  switch (notificationType) {
    case 'alerts':
      return 'always';
    case 'deploy':
      return 'committed_only';
    case 'workflow':
      return 'subscribe_only';
    default:
      return '';
  }
};

export const providerListToString = (providers: string[]): string => {
  return providers.sort().join('+');
};

export const getChoiceString = (choices: string[][], key: string): string => {
  const found = choices.find(row => row[0] === key);
  if (!found) {
    throw new Error('Could not find choice');
  }
  return found[1];
};
