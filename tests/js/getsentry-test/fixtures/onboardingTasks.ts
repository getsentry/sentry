import type {OnboardingTaskStatus} from 'sentry/types/onboarding';
import {OnboardingTaskKey} from 'sentry/types/onboarding';

export function OnboardingTasksFixture(
  params: OnboardingTaskStatus[] = []
): OnboardingTaskStatus[] {
  return [
    {
      status: 'skipped',
      dateCompleted: '2018-01-04T18:49:24.432Z',
      task: OnboardingTaskKey.FIRST_EVENT,
    },
    {
      status: 'skipped',
      dateCompleted: '2018-01-04T18:19:31.830Z',
      task: OnboardingTaskKey.ISSUE_GUIDE,
    },
    {
      status: 'skipped',
      dateCompleted: '2018-01-04T18:49:24.701Z',
      task: OnboardingTaskKey.INVITE_MEMBER,
    },
    {status: 'skipped', task: OnboardingTaskKey.FIRST_PROJECT},
    {status: 'skipped', task: OnboardingTaskKey.PERFORMANCE_GUIDE},
    {status: 'skipped', task: OnboardingTaskKey.SOURCEMAPS},
    ...params,
  ];
}
