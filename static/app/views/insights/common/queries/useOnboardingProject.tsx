import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import type {Project} from 'sentry/types/project';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';

export function useOnboardingProject({
  property,
}: {
  property?: keyof Pick<Project, 'hasLogs' | 'hasTraceMetrics' | 'firstTransactionEvent'>;
} = {}): Project | undefined {
  const {projects} = useProjects();
  const pageFilters = usePageFilters();
  const projectOnboardingProperty = property ?? 'firstTransactionEvent';

  if (projects.length === 0) {
    return undefined;
  }

  // Current selection is 'my projects' or 'all projects'
  if (
    pageFilters.selection.projects.length === 0 ||
    pageFilters.selection.projects[0] === ALL_ACCESS_PROJECTS
  ) {
    const filtered = projects.filter(p => p[projectOnboardingProperty] === false);
    if (filtered.length === projects.length) {
      return filtered[0];
    }
  }

  // Any other subset of projects.
  const filtered = projects.filter(
    p =>
      pageFilters.selection.projects.includes(parseInt(p.id, 10)) &&
      p[projectOnboardingProperty] === false
  );
  if (filtered.length === pageFilters.selection.projects.length) {
    return filtered[0];
  }

  return undefined;
}
