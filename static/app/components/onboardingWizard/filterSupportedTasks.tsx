import {
  replayOnboardingPlatforms,
  withoutPerformanceSupport,
} from 'sentry/data/platformCategories';
import {type OnboardingTask, OnboardingTaskKey} from 'sentry/types/onboarding';
import type {Project} from 'sentry/types/project';

const replayRelatedTasks = [OnboardingTaskKey.SESSION_REPLAY];
const performanceRelatedTasks = [
  OnboardingTaskKey.FIRST_TRANSACTION,
  OnboardingTaskKey.PERFORMANCE_GUIDE,
];

export function filterSupportedTasks(
  projects: Project[] | undefined,
  allTasks: OnboardingTask[]
): OnboardingTask[] {
  // If no projects, we can not know which tasks are supported
  if (!projects || (Array.isArray(projects) && projects.length === 0)) {
    return allTasks;
  }

  // Remove tasks for features that are not supported
  const excludeList = allTasks.filter(
    task =>
      (!shouldShowReplayTasks(projects) && replayRelatedTasks.includes(task.task)) ||
      (!shouldShowPerformanceTasks(projects) &&
        performanceRelatedTasks.includes(task.task))
  );
  return allTasks.filter(task => !excludeList.includes(task));
}

export function shouldShowPerformanceTasks(projects: Project[]): boolean {
  return !projects?.every(
    project => project.platform && withoutPerformanceSupport.has(project.platform)
  );
}

export function shouldShowReplayTasks(projects: Project[]): boolean {
  return projects?.some(
    project => project.platform && replayOnboardingPlatforms.includes(project.platform)
  );
}
