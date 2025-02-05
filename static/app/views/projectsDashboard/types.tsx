import type {Project, Team} from 'sentry/types';

export interface TeamWithProjects extends Team {
  projects?: Array<Project | undefined>;
}

export type FilteredProject = Project | undefined;