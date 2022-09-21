import {Group, Project} from 'sentry/types';

export interface SharedGroup extends Omit<Group, 'project'> {
  project: Pick<Project, 'name' | 'organization' | 'slug' | 'features'>;
}
