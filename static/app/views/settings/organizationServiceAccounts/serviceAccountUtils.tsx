import type {Project} from 'sentry/types/project';

import type {ServiceAccount} from './types';

export function getAccountProjects(account: ServiceAccount, projects: Project[]) {
  return account.allProjects
    ? projects
    : projects.filter(project => account.projectIds.includes(project.id));
}
