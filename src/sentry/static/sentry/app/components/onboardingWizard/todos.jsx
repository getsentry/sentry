import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import {t} from 'app/locale';

import withApi from 'app/utils/withApi';
import OrganizationState from 'app/mixins/organizationState';
import TodoItem from 'app/components/onboardingWizard/toDoItem';

const TASKS = [
  {
    task: 1,
    title: t('Create a project'),
    description: t('Create your first Sentry project'),
    detailedDescription: t(
      'Follow our quick and easy steps to set up a project and start sending errors.'
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
    detailedDescription: t('Choose your platform and send an event.'),
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
          by unlocking suggested owners, mentions, and assignment.`
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
    location: 'https://docs.sentry.io/enriching-error-data/context/#capturing-the-user',
    display: true,
  },
  {
    task: 6,
    title: t('Set up release tracking'),
    description: t('See what releases are generating errors'),
    detailedDescription: t(
      `Set up commits for additional context when determining the cause of an issue
          e.g. suggested owners and resolve issues via commit messages.`
    ),
    skippable: true,
    prereq: [1, 2],
    featureLocation: 'project',
    location: 'settings/release-tracking/',
    display: true,
  },
  {
    task: 7,
    title: t('Upload source maps'),
    description: t('Deminify JavaScript stack traces'),
    detailedDescription: t(
      `View source code context obtained from stack traces in their
          original untransformed form, which is particularly useful for debugging minified code.`
    ),
    skippable: true,
    prereq: [1, 2], // Is one of the platforms javascript?
    featureLocation: 'absolute',
    location: 'https://docs.sentry.io/platforms/javascript/sourcemaps/',
    display: true,
  },
  {
    task: 8,
    title: 'User crash reports',
    description: t('Collect user feedback when your application crashes.'),
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
    location: 'settings/plugins/',
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
];

const TodoList = createReactClass({
  propTypes: {
    api: PropTypes.object,
  },

  displayName: 'TodoList',
  mixins: [OrganizationState],

  getInitialState() {
    return {
      tasks: [],
      seeAll: false, // Show all tasks, included those completed
    };
  },

  componentWillMount() {
    // Map server task state (who finished what) to TodoList.TASK objects
    const org = this.getOrganization();
    const tasks = TASKS.map(task => {
      for (const server_task of org.onboardingTasks) {
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
    const org = this.getOrganization();
    this.props.api.request('/organizations/' + org.slug + '/onboarding-tasks/', {
      method: 'POST',
      data: {task: skipped_task, status: 'skipped'},
      success: () => {
        const new_state = this.state.tasks.map(task => {
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

  render() {
    const nextTasks = this.state.tasks.filter(task => task.display);

    const todoListTasks = nextTasks.map(task => {
      return <TodoItem key={task.task} task={task} onSkip={this.skipTask} />;
    });

    return (
      <div>
        <div className="onboarding-wrapper">
          <ul className="list-unstyled">{todoListTasks}</ul>
        </div>
      </div>
    );
  },
});

export {TodoList, TASKS};

export default withApi(TodoList);
