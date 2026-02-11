import {ProjectFixture} from 'sentry-fixture/project';

import {filterSupportedTasks} from 'sentry/components/onboardingWizard/filterSupportedTasks';
import {OnboardingTaskKey, type OnboardingTask} from 'sentry/types/onboarding';
import type {PlatformKey, Project} from 'sentry/types/project';

describe('filterSupportedTasks', () => {
  const onboardingTasks: OnboardingTask[] = [
    {
      task: OnboardingTaskKey.FIRST_PROJECT,
      title: '',
      description: '',
      skippable: false,
      actionType: 'app',
      location: '',
      display: true,
    },
    {
      task: OnboardingTaskKey.SESSION_REPLAY,
      title: '',
      description: '',
      skippable: true,
      actionType: 'app',
      location: '',
      display: true,
    },
    {
      task: OnboardingTaskKey.FIRST_TRANSACTION,
      title: '',
      description: '',
      skippable: true,
      actionType: 'app',
      location: '',
      display: true,
    },
  ];

  it('filters out nothing if any supported platform', () => {
    const supportedProject = ProjectFixture({
      platform: 'javascript-react',
    }) as Project & {platform: PlatformKey};
    const unsupportedProject = ProjectFixture({
      platform: 'nintendo-switch',
    }) as Project & {platform: PlatformKey};
    const supportedTasks = filterSupportedTasks(
      [supportedProject, unsupportedProject],
      onboardingTasks
    );
    expect(supportedTasks).toHaveLength(3);
  });

  it('filters out for unsupported platform', () => {
    const project = ProjectFixture({
      platform: 'nintendo-switch',
      firstTransactionEvent: false,
    }) as Project & {platform: PlatformKey};
    const supportedTasks = filterSupportedTasks([project], onboardingTasks);
    expect(supportedTasks).toHaveLength(1);
  });

  it('filters out performance only if all projects are without support', () => {
    const project1 = ProjectFixture({
      platform: 'nintendo-switch',
      firstTransactionEvent: false,
    }) as Project & {platform: PlatformKey};
    const project2 = ProjectFixture({
      platform: 'elixir',
      firstTransactionEvent: false,
    }) as Project & {platform: PlatformKey};

    const supportedTasks = filterSupportedTasks([project1, project2], onboardingTasks);
    expect(
      supportedTasks.filter(task =>
        [OnboardingTaskKey.FIRST_PROJECT, OnboardingTaskKey.SESSION_REPLAY].includes(
          task.task
        )
      )
    ).toHaveLength(2);
  });
});
