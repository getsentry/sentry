import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';
import {setMockDate} from 'sentry-test/utils';

import * as taskConfig from 'sentry/components/onboardingWizard/taskConfig';
import * as useOnboardingTasks from 'sentry/components/onboardingWizard/useOnboardingTasks';
import {findCompleteOrOverdueTasks} from 'sentry/components/onboardingWizard/utils';
import {OnboardingStatus} from 'sentry/components/sidebar/onboardingStatus';
import {SidebarPanelKey} from 'sentry/components/sidebar/types';
import {type OnboardingTask, OnboardingTaskKey} from 'sentry/types/onboarding';
import type {Organization} from 'sentry/types/organization';

function renderMockRequests(organization: Organization) {
  const getOnboardingTasksMock = MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/onboarding-tasks/`,
    method: 'GET',
    body: {
      onboardingTasks: organization.onboardingTasks,
    },
  });

  const mutateOnboardingTasksMock = MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/onboarding-tasks/`,
    method: 'POST',
  });

  const mutateUserOptionsMock = MockApiClient.addMockResponse({
    url: `/users/me/`,
    method: 'PUT',
  });

  return {getOnboardingTasksMock, mutateUserOptionsMock, mutateOnboardingTasksMock};
}

describe('Onboarding Status', function () {
  const organizationId = OrganizationFixture().id;

  it('panel is collapsed and has pending tasks to be seen', async function () {
    const organization = OrganizationFixture({
      id: organizationId,
      features: ['onboarding'],
      onboardingTasks: [
        {
          task: OnboardingTaskKey.FIRST_PROJECT,
          status: 'complete',
          completionSeen: undefined,
          dateCompleted: undefined,
        },
      ],
    });

    const {mutateUserOptionsMock, getOnboardingTasksMock} =
      renderMockRequests(organization);

    const handleShowPanel = jest.fn();

    render(
      <OnboardingStatus
        currentPanel=""
        onShowPanel={handleShowPanel}
        hidePanel={jest.fn()}
        collapsed
        orientation="left"
      />,
      {
        organization,
      }
    );

    expect(screen.getByRole('button', {name: 'Onboarding'})).toBeInTheDocument();
    expect(screen.getByText('1 completed task')).toBeInTheDocument();
    expect(screen.getByTestId('pending-seen-indicator')).toBeInTheDocument();

    expect(mutateUserOptionsMock).not.toHaveBeenCalled();

    // By hovering over the button, we should refetch the data
    await userEvent.hover(screen.getByRole('button', {name: 'Onboarding'}));
    await waitFor(() => expect(getOnboardingTasksMock).toHaveBeenCalled());

    // Open the panel
    await userEvent.click(screen.getByRole('button', {name: 'Onboarding'}));
    await waitFor(() => expect(getOnboardingTasksMock).toHaveBeenCalled());
    expect(handleShowPanel).toHaveBeenCalled();
  });

  it('panel is expanded and has no pending tasks to be seen', async function () {
    const organization = OrganizationFixture({
      id: organizationId,
      features: ['onboarding'],
      onboardingTasks: [
        {
          task: OnboardingTaskKey.FIRST_PROJECT,
          status: 'complete',
          completionSeen: '2024-12-16T14:52:01.385227Z',
          dateCompleted: '2024-12-13T09:35:05.010028Z',
        },
      ],
    });

    const {getOnboardingTasksMock} = renderMockRequests(organization);

    const handleHidePanel = jest.fn();

    render(
      <OnboardingStatus
        currentPanel={SidebarPanelKey.ONBOARDING_WIZARD}
        onShowPanel={jest.fn()}
        hidePanel={handleHidePanel}
        collapsed={false}
        orientation="left"
      />,
      {
        organization,
      }
    );

    expect(screen.getByText('1 completed task')).toBeInTheDocument();

    // Do not show the pending indicator
    expect(screen.queryByTestId('pending-seen-indicator')).not.toBeInTheDocument();

    // Shows the panel
    expect(screen.getAllByText('Onboarding')).toHaveLength(2);

    // Triggers a fetch request
    expect(getOnboardingTasksMock).toHaveBeenCalled();

    // Hide Panel
    await userEvent.click(screen.getByLabelText('Close Panel'));
    await waitFor(() => expect(handleHidePanel).toHaveBeenCalled());
  });

  it('panel is skipped if all tasks are done and completionSeen is overdue', function () {
    const organization = OrganizationFixture({
      id: organizationId,
      features: ['onboarding'],
    });

    setMockDate(new Date('2025-02-26'));

    const allTasks = taskConfig
      .getOnboardingTasks({organization, projects: [ProjectFixture()]})
      .filter(task =>
        [OnboardingTaskKey.FIRST_PROJECT, OnboardingTaskKey.SECOND_PLATFORM].includes(
          task.task
        )
      );

    const doneTasks: OnboardingTask[] = allTasks.map(task => ({
      ...task,
      status: 'complete',
      dateCompleted: '2025-02-11',
      completionSeen: undefined,
    }));

    jest.spyOn(useOnboardingTasks, 'useOnboardingTasks').mockReturnValue({
      allTasks: doneTasks,
      beyondBasicsTasks: [],
      completeTasks: [],
      completeOrOverdueTasks: doneTasks.filter(findCompleteOrOverdueTasks),
      doneTasks,
      gettingStartedTasks: [],
      refetch: jest.fn(),
    });

    const {mutateOnboardingTasksMock} = renderMockRequests(organization);

    render(
      <OnboardingStatus
        currentPanel=""
        onShowPanel={jest.fn()}
        hidePanel={jest.fn()}
        collapsed
        orientation="left"
      />,
      {
        organization,
      }
    );

    expect(mutateOnboardingTasksMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', {name: 'Onboarding'})).not.toBeInTheDocument();
  });
});
