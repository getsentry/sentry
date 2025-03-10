import type {OnboardingTask} from 'sentry/types/onboarding';

function isTaskOverdue2Weeks(dateCompleted: string): boolean {
  const now = new Date();
  const timeDifference = now.getTime() - new Date(dateCompleted).getTime();
  return timeDifference > 14 * 24 * 60 * 60 * 1000; // 14 days in milliseconds
}

export const taskIsDone = (task: OnboardingTask) =>
  ['complete', 'skipped'].includes(task.status);

export const findCompleteTasks = (task: OnboardingTask) => {
  const isOverdue = task.dateCompleted && isTaskOverdue2Weeks(task.dateCompleted);
  return (
    ['complete', 'skipped'].includes(task.status) && (task.completionSeen || isOverdue)
  );
};
