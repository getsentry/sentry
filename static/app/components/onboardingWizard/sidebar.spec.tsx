import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {OnboardingSidebar} from 'sentry/components/onboardingWizard/sidebar';
import {type OnboardingTask, OnboardingTaskKey} from 'sentry/types/onboarding';

const gettingStartedTasks: OnboardingTask[] = [
  {
    task: OnboardingTaskKey.FIRST_PROJECT,
    title: 'Create your first project',
    description: 'Select your platform and install the Sentry SDK',
    skippable: false,
    actionType: 'app',
    location: '',
    display: true,
    requisites: [],
    requisiteTasks: [],
    status: 'pending',
  },
  {
    task: OnboardingTaskKey.FIRST_EVENT,
    title: 'Send your first error',
    description: 'Throw an error in your app',
    skippable: false,
    actionType: 'app',
    location: '',
    display: true,
    requisites: [],
    requisiteTasks: [],
    status: 'pending',
  },
];

const beyondBasicsTasks: OnboardingTask[] = [
  {
    task: OnboardingTaskKey.FIRST_TRANSACTION,
    title: 'Setup Tracing',
    description: 'Capture your first transaction',
    skippable: true,
    requisites: [],
    actionType: 'app',
    location: '',
    display: true,
    requisiteTasks: [],
    status: 'pending',
  },
];

describe('Sidebar', function () {
  it('should render the sidebar with the correct groups and tasks', async function () {
    render(
      <OnboardingSidebar
        onClose={jest.fn()}
        orientation="left"
        collapsed={false}
        gettingStartedTasks={gettingStartedTasks}
        beyondBasicsTasks={beyondBasicsTasks}
      />
    );

    // Group 1
    expect(screen.getByText('Getting Started')).toBeInTheDocument();
    expect(screen.getByText('0 out of 2 tasks completed')).toBeInTheDocument();
    // This means that the group is expanded
    expect(screen.getByRole('button', {name: 'Collapse'})).toBeInTheDocument();
    expect(screen.getByText(gettingStartedTasks[0]!.title)).toBeInTheDocument();
    expect(screen.getByText(gettingStartedTasks[0]!.description)).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Skip Task'})).not.toBeInTheDocument();

    // Group 2
    expect(screen.getByText('Beyond the Basics')).toBeInTheDocument();
    expect(screen.getByText('0 out of 1 task completed')).toBeInTheDocument();
    // This means that the group is not expanded
    expect(screen.queryByText(beyondBasicsTasks[0]!.title)).not.toBeInTheDocument();

    // Manually expand second group
    await userEvent.click(screen.getByRole('button', {name: 'Expand'}));
    // Tasks from the second group should be visible
    expect(await screen.findByText(beyondBasicsTasks[0]!.title)).toBeInTheDocument();
    // task from second group are skippable
    expect(screen.getByRole('button', {name: 'Skip Task'})).toBeInTheDocument();
  });

  it('if first group completed, second group should be expanded by default', function () {
    render(
      <OnboardingSidebar
        onClose={jest.fn()}
        orientation="left"
        collapsed={false}
        gettingStartedTasks={gettingStartedTasks.map(task => ({
          ...task,
          completionSeen: true,
          status: 'complete',
        }))}
        beyondBasicsTasks={beyondBasicsTasks}
      />
    );

    // Group 1
    expect(screen.getByText('Getting Started')).toBeInTheDocument();
    expect(screen.getByText('2 out of 2 tasks completed')).toBeInTheDocument();

    // Group 2
    // This means that the group is expanded
    expect(screen.getByText(beyondBasicsTasks[0]!.title)).toBeInTheDocument();
  });

  it('show skipable confirmation when skipping a task', async function () {
    const {organization} = initializeOrg();

    const mockUpdate = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/onboarding-tasks/`,
      method: 'POST',
    });

    render(
      <OnboardingSidebar
        onClose={jest.fn()}
        orientation="left"
        collapsed={false}
        gettingStartedTasks={gettingStartedTasks}
        beyondBasicsTasks={beyondBasicsTasks}
      />,
      {
        organization,
      }
    );

    // Manually expand second group
    await userEvent.click(screen.getByRole('button', {name: 'Expand'}));
    // Tasks from the second group should be visible
    expect(await screen.findByText(beyondBasicsTasks[0]!.title)).toBeInTheDocument();

    // Click skip task
    await userEvent.click(screen.getByRole('button', {name: 'Skip Task'}));

    // Confirmation to skip should be visible
    expect(await screen.findByText(/Not sure what to do/)).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Just Skip'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Help'})).toBeInTheDocument();

    // Click help
    await userEvent.click(screen.getByRole('button', {name: 'Help'}));

    // Show help menu
    expect(await screen.findByText('Search Support, Docs and More')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Contact Support'})).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Join our Discord'})).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Visit Help Center'})).toBeInTheDocument();

    // Dismiss skip confirmation
    await userEvent.click(screen.getByRole('button', {name: 'Dismiss Skip'}));
    expect(screen.queryByText(/Not sure what to do/)).not.toBeInTheDocument();

    // Click skip task again
    await userEvent.click(screen.getByRole('button', {name: 'Skip Task'}));

    // Click 'Just Skip'
    await userEvent.click(screen.getByRole('button', {name: 'Just Skip'}));
    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/onboarding-tasks/`,
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'skipped',
            task: OnboardingTaskKey.FIRST_TRANSACTION,
          }),
        })
      );
    });
  });
});
