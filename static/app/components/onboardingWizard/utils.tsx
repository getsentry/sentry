import type {OnboardingTask} from 'sentry/types/onboarding';

function isTaskOverdue2Weeks(dateCompleted: string): boolean {
  const now = new Date();
  const timeDifference = now.getTime() - new Date(dateCompleted).getTime();
  return timeDifference > 14 * 24 * 60 * 60 * 1000; // 14 days in milliseconds
}

export function taskIsDone(task: OnboardingTask) {
  return ['complete', 'skipped'].includes(task.status);
}

export function findCompleteTasks(task: OnboardingTask) {
  return taskIsDone(task) && task.completionSeen;
}

function findOverdueTasks(task: OnboardingTask) {
  return (
    taskIsDone(task) && task.dateCompleted && isTaskOverdue2Weeks(task.dateCompleted)
  );
}

export function findCompleteOrOverdueTasks(task: OnboardingTask) {
  return findCompleteTasks(task) || findOverdueTasks(task);
}
