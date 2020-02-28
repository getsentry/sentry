import React from 'react';
import styled from '@emotion/styled';

import getOnboardingTasks from 'app/components/onboardingWizard/getOnboardingTasks';
import TodoItem from 'app/components/onboardingWizard/toDoItem';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';
import {Client} from 'app/api';
import {Organization, OnboardingTask, OnboardingTaskKey} from 'app/types';
import {updateOnboardingTask} from 'app/actionCreators/onboardingTasks';

type Props = {
  api: Client;
  organization: Organization;
};

function getMergedTasks(organization: Organization) {
  const taskDescriptors = getOnboardingTasks(organization);
  const serverTasks = organization.onboardingTasks;

  // Map server task state (i.e. completed status) with tasks objects
  return taskDescriptors.map(
    desc =>
      ({
        ...desc,
        ...serverTasks.find(serverTask => serverTask.task === desc.task),
      } as OnboardingTask)
  );
}

const TodoList = ({api, organization}: Props) => (
  <StyledTodoList>
    {getMergedTasks(organization)
      .filter(task => task.display)
      .map(task => (
        <TodoItem
          key={task.task}
          task={task}
          onSkip={(skippedTask: OnboardingTaskKey) =>
            updateOnboardingTask(api, organization, {
              task: skippedTask,
              status: 'skipped',
            })
          }
        />
      ))}
  </StyledTodoList>
);

const StyledTodoList = styled('ul')`
  padding-left: 0;
  list-style: none;
`;

export default withApi(withOrganization(TodoList));
