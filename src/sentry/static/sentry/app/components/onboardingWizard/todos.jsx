import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {t} from 'app/locale';
import SentryTypes from 'app/sentryTypes';
import TodoItem from 'app/components/onboardingWizard/toDoItem';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';

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
    title: t('Invite team members'),
    description: t('Bring your team aboard'),
    detailedDescription: t(
      `Let Sentry help your team triage and assign issues. Improve your workflow
          by unlocking mentions, assignment, and suggested issue owners.`
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
    detailedDescription: t('Capture errors from both your front and back ends.'),
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
          drill down into the number of users affected by an issue and get a broader sense about the quality of your application.`
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
    description: t('See which releases cause errors'),
    detailedDescription: t(
      `Set up releases and associate commits to gain additional context when determining the cause of an issue
          and unlock the ability to resolve issues via commit message.`
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
      `View source code context obtained from stack traces in its
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
    description: t('Receive Sentry alerts in Slack, PagerDuty, and more.'),
    skippable: true,
    prereq: [1, 2],
    featureLocation: 'project',
    location: 'settings/alerts/',
    display: false,
  },
];

class TodoList extends React.Component {
  static propTypes = {
    api: PropTypes.object,
    organization: SentryTypes.Organization,
  };

  state = {
    tasks: [],
    seeAll: false, // Show all tasks, included those completed
  };

  componentWillMount() {
    // Map server task state (who finished what) to TodoList.TASK objects
    const org = this.props.organization;
    const tasks = TASKS.map(task => {
      for (const serverTask of org.onboardingTasks) {
        if (serverTask.task === task.task) {
          Object.assign(task, serverTask);
          break;
        }
      }
      return task;
    });
    this.setState({tasks});
  }

  skipTask = skippedTask => {
    const org = this.props.organization;
    this.props.api.request('/organizations/' + org.slug + '/onboarding-tasks/', {
      method: 'POST',
      data: {task: skippedTask, status: 'skipped'},
      success: () => {
        const newState = this.state.tasks.map(task => {
          if (task.task === skippedTask) {
            task.status = 'skipped';
          }
          return task;
        });
        this.setState({tasks: newState});
      },
    });
  };

  render() {
    const nextTasks = this.state.tasks.filter(task => task.display);

    const todoListTasks = nextTasks.map(task => {
      return <TodoItem key={task.task} task={task} onSkip={this.skipTask} />;
    });

    return <StyledTodoList>{todoListTasks}</StyledTodoList>;
  }
}

const StyledTodoList = styled('ul')`
  padding-left: 0;
  list-style: none;
`;

export {TodoList, TASKS};

export default withApi(withOrganization(TodoList));
