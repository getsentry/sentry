import {ProjectFixture} from 'sentry-fixture/project';

import {filterSupportedTasks} from 'sentry/components/onboardingWizard/filterSupportedTasks';
import {type OnboardingTask, OnboardingTaskKey} from 'sentry/types/onboarding';
import type {PlatformKey, Project} from 'sentry/types/project';

describe('filterSupportedTasks', function () {
  const onboardingTasks: OnboardingTask[] = [
    {
      task: OnboardingTaskKey.FIRST_PROJECT,
      title: '',
      description: '',
      skippable: false,
      actionType: 'app',
      location: '',
      display: true,
      requisites: [],
      requisiteTasks: [],
      status: 'pending',
    },
    {
      task: OnboardingTaskKey.SESSION_REPLAY,
      title: '',
      description: '',
      skippable: true,
      requisites: [],
      actionType: 'app',
      location: '',
      display: true,
      requisiteTasks: [],
      status: 'pending',
    },
    {
      task: OnboardingTaskKey.USER_REPORTS,
      title: '',
      description: '',
      skippable: true,
      requisites: [],
      actionType: 'app',
      location: '',
      display: true,
      requisiteTasks: [],
      status: 'pending',
    },
    {
      task: OnboardingTaskKey.FIRST_TRANSACTION,
      title: '',
      description: '',
      skippable: true,
      requisites: [],
      actionType: 'app',
      location: '',
      display: true,
      requisiteTasks: [],
      status: 'pending',
    },
  ];

  it('filters out nothing if any supported platform', function () {
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
    expect(supportedTasks).toHaveLength(4);
  });

  it('filters out for unsupported platform', function () {
    const project = ProjectFixture({
      platform: 'nintendo-switch',
      firstTransactionEvent: false,
    }) as Project & {platform: PlatformKey};
    const supportedTasks = filterSupportedTasks([project], onboardingTasks);
    expect(supportedTasks).toHaveLength(1);
  });

  it('filters out performance only if all projects are without support', function () {
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
        [
          OnboardingTaskKey.FIRST_PROJECT,
          OnboardingTaskKey.SESSION_REPLAY,
          OnboardingTaskKey.USER_REPORTS,
        ].includes(task.task)
      )
    ).toHaveLength(3);
  });
});
