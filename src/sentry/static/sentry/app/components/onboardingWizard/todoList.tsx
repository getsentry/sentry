import React from 'react';
import styled from '@emotion/styled';

import getOnboardingTasks from 'app/components/onboardingWizard/getOnboardingTasks';
import TodoItem from 'app/components/onboardingWizard/toDoItem';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';
import {Client} from 'app/api';
import {Organization, OnboardingTask} from 'app/types';

type Props = {
  api: Client;
  organization: Organization;
};

type State = {
  tasks: OnboardingTask[];
  seeAll: boolean;
};

class TodoList extends React.Component<Props, State> {
  state: State = {
    tasks: [],
    seeAll: false, // Show all tasks, included those completed
  };

  componentDidMount() {
    const {organization} = this.props;
    const taskDescriptors = getOnboardingTasks(organization);
    const serverTasks = organization.onboardingTasks;

    // Map server task state (i.e. completed status) with tasks objects
    const tasks = taskDescriptors.map(
      desc =>
        ({
          ...desc,
          ...serverTasks.find(serverTask => serverTask.task === desc.task),
        } as OnboardingTask)
    );

    // eslint-disable-next-line react/no-did-mount-set-state
    this.setState({tasks});
  }

  skipTask = async (skippedTask: number) => {
    const {organization, api} = this.props;

    await api.requestPromise(`/organizations/${organization.slug}/onboarding-tasks/`, {
      method: 'POST',
      data: {task: skippedTask, status: 'skipped'},
    });

    this.setState({
      tasks: this.state.tasks.map(task =>
        task.task === skippedTask ? {...task, status: 'skipped'} : task
      ),
    });
  };

  render() {
    const allDisplayedTasks = this.state.tasks.filter(task => task.display);

    const todoListTasks = allDisplayedTasks.map(task => (
      <TodoItem key={task.task} task={task} onSkip={this.skipTask} />
    ));

    return <StyledTodoList>{todoListTasks}</StyledTodoList>;
  }
}

const StyledTodoList = styled('ul')`
  padding-left: 0;
  list-style: none;
`;

export default withApi(withOrganization(TodoList));
