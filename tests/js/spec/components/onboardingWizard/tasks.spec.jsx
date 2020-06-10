import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import Task from 'app/components/onboardingWizard/task';
import {getOnboardingTasks} from 'app/components/onboardingWizard/taskConfig';
import {OnboardingTaskKey} from 'app/types';
import {navigateTo} from 'app/actionCreators/navigation';

jest.mock('app/actionCreators/navigation');

describe('Task', () => {
  const project = TestStubs.Project({id: '1', slug: 'angryGoose'});
  const org = TestStubs.Organization({projects: [project], slug: 'GamesCorp'});
  const tasks = getOnboardingTasks(org);

  it('renders', () => {
    const mockTask = Object.assign({}, tasks[0]);
    mockTask.requisiteTasks = mockTask.requisites;
    const wrapper = mountWithTheme(
      <Task organization={org} task={mockTask} />,
      TestStubs.routerContext()
    );

    expect(wrapper.find('Title').exists()).toBe(true);
  });

  describe('Add a Second Platform', () => {
    let second_platform_task;

    beforeEach(() => {
      second_platform_task = Object.assign(
        {},
        tasks.find(t => t.task === OnboardingTaskKey.SECOND_PLATFORM)
      );
      second_platform_task.requisiteTasks = second_platform_task.requisites;
    });

    it('renders without send event prompt initially', () => {
      const wrapper = mountWithTheme(
        <Task organization={org} task={second_platform_task} />,
        TestStubs.routerContext()
      );

      expect(wrapper.find('[data-test-id="send-event-prompt"]').exists()).toBe(false);
    });

    it('renders send event prompt when status is pending', () => {
      second_platform_task.status = 'pending';

      const wrapper = mountWithTheme(
        <Task organization={org} task={second_platform_task} />,
        TestStubs.routerContext()
      );

      expect(wrapper.find('[data-test-id="send-event-prompt"]').exists()).toBe(true);
    });

    it('links to create new project page before task is started', () => {
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
      second_platform_task.status = 'pending';
      second_platform_task.project = 1;

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
      second_platform_task.status = 'pending';

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
