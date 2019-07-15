import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import getOnboardingTasks from 'app/components/onboardingWizard/getOnboardingTasks';
import SentryTypes from 'app/sentryTypes';
import TodoItem from 'app/components/onboardingWizard/toDoItem';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';

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
    const {organization} = this.props;
    const tasks = getOnboardingTasks(organization);

    // Map server task state (i.e. completed status) to tasks objects
    tasks.map(task => {
      for (const serverTask of organization.onboardingTasks) {
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
    const {organization, api} = this.props;

    api.request('/organizations/' + organization.slug + '/onboarding-tasks/', {
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
    const allDisplayedTasks = this.state.tasks.filter(task => task.display);

    const todoListTasks = allDisplayedTasks.map(task => {
      return <TodoItem key={task.task} task={task} onSkip={this.skipTask} />;
    });

    return <StyledTodoList>{todoListTasks}</StyledTodoList>;
  }
}

const StyledTodoList = styled('ul')`
  padding-left: 0;
  list-style: none;
`;

export default withApi(withOrganization(TodoList));
