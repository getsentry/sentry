import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import Task from 'app/components/onboardingWizard/task';
import {getMergedTasks} from 'app/components/onboardingWizard/taskConfig';
import {OnboardingTaskKey} from 'app/types';
import {navigateTo} from 'app/actionCreators/navigation';

jest.mock('app/actionCreators/navigation');

describe('Task', () => {
  let org;
  let project;
  beforeEach(() => {
    project = TestStubs.Project({id: '1', slug: 'angryGoose'});
    org = TestStubs.Organization({projects: [project], slug: 'GamesCorp'});
  });

  it('renders', () => {
    const tasks = getMergedTasks(org);
    const mockTask = tasks[0];

    const wrapper = mountWithTheme(
      <Task organization={org} task={mockTask} />,
      TestStubs.routerContext()
    );

    expect(wrapper.find('Title').exists()).toBe(true);
  });

  describe('Add a Second Platform', () => {
    it('renders without send event prompt initially', () => {
      const tasks = getMergedTasks(org);
      const second_platform_task = tasks.find(
        t => t.task === OnboardingTaskKey.SECOND_PLATFORM
      );
      const wrapper = mountWithTheme(
        <Task organization={org} task={second_platform_task} />,
        TestStubs.routerContext()
      );

      expect(wrapper.find('[data-test-id="send-event-prompt"]').exists()).toBe(false);
    });

    it('renders send event prompt when status is pending', () => {
      org.onboardingTasks = [
        {
          task: OnboardingTaskKey.SECOND_PLATFORM,
          status: 'pending',
        },
      ];
      const tasks = getMergedTasks(org);
      const second_platform_task = tasks.find(
        t => t.task === OnboardingTaskKey.SECOND_PLATFORM
      );

      const wrapper = mountWithTheme(
        <Task organization={org} task={second_platform_task} />,
        TestStubs.routerContext()
      );

      expect(wrapper.find('[data-test-id="send-event-prompt"]').exists()).toBe(true);
    });

    it('links to create new project page before task is started', () => {
      const tasks = getMergedTasks(org);
      const second_platform_task = tasks.find(
        t => t.task === OnboardingTaskKey.SECOND_PLATFORM
      );
      const wrapper = mountWithTheme(
        <Task organization={org} task={second_platform_task} />,
        TestStubs.routerContext()
      );
      wrapper
        .find('[data-test-id="setup_second_platform"]')
        .first()
        .simulate('click');

      expect(navigateTo).toHaveBeenCalledWith(
        `${second_platform_task.location}?onboardingTask`,
        expect.anything()
      );
      navigateTo.mockClear();
    });

    it('links to project configuration page after project is created', () => {
      org.onboardingTasks = [
        {
          task: OnboardingTaskKey.SECOND_PLATFORM,
          status: 'pending',
          project: 1,
        },
      ];
      const tasks = getMergedTasks(org);
      const second_platform_task = tasks.find(
        t => t.task === OnboardingTaskKey.SECOND_PLATFORM
      );

      const wrapper = mountWithTheme(
        <Task organization={org} task={second_platform_task} />,
        TestStubs.routerContext()
      );
      wrapper
        .find('[data-test-id="setup_second_platform"]')
        .first()
        .simulate('click');

      expect(navigateTo).toHaveBeenCalledWith(
        `/settings/${org.slug}/projects/${project.slug}/install/?onboardingTask`,
        expect.anything()
      );
      navigateTo.mockClear();
    });

    it('passes :projectId to router when project id cannot be resolved', () => {
      org.onboardingTasks = [
        {
          task: OnboardingTaskKey.SECOND_PLATFORM,
          status: 'pending',
        },
      ];
      const tasks = getMergedTasks(org);
      const second_platform_task = tasks.find(
        t => t.task === OnboardingTaskKey.SECOND_PLATFORM
      );

      const wrapper = mountWithTheme(
        <Task organization={org} task={second_platform_task} />,
        TestStubs.routerContext()
      );
      wrapper
        .find('[data-test-id="setup_second_platform"]')
        .first()
        .simulate('click');

      expect(navigateTo).toHaveBeenCalledWith(
        `/settings/${org.slug}/projects/:projectId/install/?onboardingTask`,
        expect.anything()
      );
      navigateTo.mockClear();
    });
  });
});
