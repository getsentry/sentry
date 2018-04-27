import React from 'react';
import createReactClass from 'create-react-class';
import {t} from 'app/locale';

import ApiMixin from 'app/mixins/apiMixin';
import OrganizationState from 'app/mixins/organizationState';
import TodoItem from 'app/components/onboardingWizard/toDoItem';

const TodoList = createReactClass({
  displayName: 'TodoList',
  mixins: [ApiMixin, OrganizationState],

  statics: {
    TASKS: [
      {
        task: 1,
        title: t('Create a project'),
        description: t('Create your first Sentry project'),
        detailedDescription: t(
          'Follow our quick and easy steps to set up a project and start sending errors'
        ),
        skippable: false,
        prereq: [],
        featureLocation: 'organization',
        location: 'projects/new/',
        display: true,
      },
      {
        task: 2,
        title: t('Send your first event'),
        description: t("Install Sentry's client"),
        detailedDescription: t('Choose your platform and send an event'),
        skippable: false,
        prereq: [1],
        featureLocation: 'project',
        location: 'settings/install/',
        display: true,
      },
      {
        task: 3,
        title: t('Invite team member'),
        description: t('Bring your team aboard'),
        detailedDescription: t(
          `Let Sentry help your team triage and assign issues. Improve your workflow
          by unlocking suggested owners, mentions, and assignment`
        ),
        skippable: true,
        prereq: [],
        featureLocation: 'organization',
        location: 'members/',
        display: true,
      },
      {
        task: 4,
        title: t('Add a second platform'),
        description: t('Add Sentry to a second platform'),
        detailedDescription: t(
          'Cross platform functionality to support both your frontend and backend.'
        ),
        skippable: true,
        prereq: [1, 2],
        featureLocation: 'organization',
        location: 'projects/new/',
        display: true,
      },
      {
        task: 5,
        title: t('Add user context'),
        description: t('Know who is being affected by crashes'),
        detailedDescription: t(
          `Unlock features that let you
          drill down into the number of users affected by an issue as well as get a broader sense about the quality of the application.`
        ),
        skippable: true,
        prereq: [1, 2],
        featureLocation: 'absolute',
        location: 'https://docs.sentry.io/hosted/learn/context/#capturing-the-user',
        display: true,
      },
      {
        task: 6,
        title: t('Set up release tracking'),
        description: t('See what releases are generating errors'),
        detailedDescription: t(
          `Set up commits for additional context when determining the cause of an issue
          e.g. suggested owners and resolve issues via commit messages`
        ),
        skippable: true,
        prereq: [1, 2],
        featureLocation: 'project',
        location: 'settings/release-tracking/',
        display: true,
      },
      {
        task: 7,
        title: t('Upload sourcemaps'),
        description: t('Deminify javascript stacktraces'),
        detailedDescription: t(
          `View source code context obtained from stack traces in their
          original untransformed form, which is particularly useful for debugging minified code`
        ),
        skippable: true,
        prereq: [1, 2], // Is one of the platforms javascript?
        featureLocation: 'absolute',
        location: 'https://docs.sentry.io/hosted/clients/javascript/sourcemaps/',
        display: true,
      },
      {
        task: 8,
        title: 'User crash reports',
        description: t('Collect user feedback when your application crashes'),
        skippable: true,
        prereq: [1, 2, 5],
        featureLocation: 'project',
        location: 'settings/user-reports/',
        display: false,
      },
      {
        task: 9,
        title: t('Set up issue tracking'),
        description: t('Link to Sentry issues within your issue tracker'),
        skippable: true,
        prereq: [1, 2],
        featureLocation: 'project',
        location: 'settings/issue-tracking/',
        display: false,
      },
      {
        task: 10,
        title: t('Set up an alerts service'),
        description: t('Receive Sentry alerts in Slack or HipChat'),
        skippable: true,
        prereq: [1, 2],
        featureLocation: 'project',
        location: 'settings/alerts/',
        display: false,
      },
    ],
  },

  getInitialState() {
    return {
      tasks: [],
      seeAll: false, // Show all tasks, included those completed
    };
  },

  componentWillMount() {
    // Map server task state (who finished what) to TodoList.TASK objects
    let org = this.getOrganization();
    let tasks = TodoList.TASKS.map(task => {
      for (let server_task of org.onboardingTasks) {
        if (server_task.task == task.task) {
          Object.assign(task, server_task);
          break;
        }
      }
      return task;
    });
    this.setState({tasks});
  },

  skipTask(skipped_task) {
    let org = this.getOrganization();
    this.api.request('/organizations/' + org.slug + '/onboarding-tasks/', {
      method: 'POST',
      data: {task: skipped_task, status: 'skipped'},
      success: () => {
        let new_state = this.state.tasks.map(task => {
          if (task.task == skipped_task) {
            task.status = 'skipped';
          }
          return task;
        });
        this.setState({tasks: new_state});
      },
    });
    this.getOnboardingTasks();
  },

  click(e) {
    e.stopPropagation();
  },

  render() {
    let nextTasks = this.state.tasks.filter(task => task.display);

    let todoListTasks = nextTasks.map(task => {
      return <TodoItem key={task.task} task={task} onSkip={this.skipTask} />;
    });

    return (
      <div>
        <div onClick={this.click} className="onboarding-wrapper">
          <ul className="list-unstyled">{todoListTasks}</ul>
        </div>
      </div>
    );
  },
});

export default TodoList;
