import {
  withoutPerformanceSupport,
  withPerformanceOnboarding,
} from 'sentry/data/platformCategories';
import {Project} from 'sentry/types';

export function filterProjects(rawProjects: Project[]) {
  // filter on projects that have not sent a first transaction event
  const projectsWithoutFirstTransactionEvent = rawProjects.filter(
    p =>
      p.firstTransactionEvent === false &&
      (!p.platform || !withoutPerformanceSupport.has(p.platform))
  );

  // additionally filter on projects that have performance onboarding checklist support
  const projectsForOnboarding = projectsWithoutFirstTransactionEvent.filter(
    p => p.platform && withPerformanceOnboarding.has(p.platform)
  );

  return {
    projectsWithoutFirstTransactionEvent,
    projectsForOnboarding,
  };
}
