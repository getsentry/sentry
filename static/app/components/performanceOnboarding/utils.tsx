import {
  withoutPerformanceSupport,
  withPerformanceOnboarding,
} from 'sentry/data/platformCategories';
import {PlatformIntegration, PlatformKey, Project} from 'sentry/types';

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

export function generateDocKeys(platform: PlatformKey): string[] {
  return ['1-install', '2-configure', '3-verify'].map(
    key => `${platform}-performance-onboarding-${key}`
  );
}

export function isPlatformSupported(platform: undefined | PlatformIntegration) {
  if (!platform) {
    return false;
  }
  const hasPerformanceOnboarding = platform
    ? withPerformanceOnboarding.has(platform.id)
    : false;

  const doesNotSupportPerformance = platform
    ? withoutPerformanceSupport.has(platform.id)
    : false;
  return hasPerformanceOnboarding && !doesNotSupportPerformance;
}
