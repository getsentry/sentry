import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {OnboardingSidebarContent} from 'sentry/components/onboardingWizard/content';
import {OnboardingTaskKey} from 'sentry/types/onboarding';

const DEFAULT_GETTING_STARTED_TASKS = [
  {task: OnboardingTaskKey.FIRST_PROJECT, title: 'Create your first project'},
  {task: OnboardingTaskKey.FIRST_EVENT, title: 'Capture your first error'},
  {task: OnboardingTaskKey.INVITE_MEMBER, title: 'Invite your team'},
  {
    task: OnboardingTaskKey.LINK_SENTRY_TO_SOURCE_CODE,
    title: 'Link Sentry to Source Code',
  },
  {task: OnboardingTaskKey.RELEASE_TRACKING, title: 'Track releases'},
  {task: OnboardingTaskKey.ALERT_RULE, title: 'Configure an Issue Alert'},
];

const DEFAULT_BEYOND_THE_BASICS_TASKS = [
  {task: OnboardingTaskKey.REAL_TIME_NOTIFICATIONS, title: 'Get real-time notifications'},
  {
    task: OnboardingTaskKey.SECOND_PLATFORM,
    title: 'Add Sentry to other parts of your app',
  },
  {task: OnboardingTaskKey.FIRST_TRANSACTION, title: 'Set up Tracing'},
];

const organization = OrganizationFixture({
  features: ['onboarding'],
});

describe('OnboardingSidebarContent', function () {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/onboarding-tasks/',
      method: 'GET',
      body: {
        onboardingTasks: [],
      },
    });
  });

  it('should render the sidebar with the correct groups and tasks', async function () {
    render(<OnboardingSidebarContent onClose={jest.fn()} />, {organization});

    // Group 1
    expect(await screen.findByText('Getting Started')).toBeInTheDocument();
    expect(screen.getByText('0 out of 6 tasks completed')).toBeInTheDocument();
    // This means that the group is expanded
    expect(screen.getByRole('button', {name: 'Collapse'})).toBeInTheDocument();

    for (const task of DEFAULT_GETTING_STARTED_TASKS) {
      expect(
        screen.getByRole('button', {name: new RegExp(task.title)})
      ).toBeInTheDocument();
    }

    // Displays descriptions
    expect(
      screen.getByText(/Select your platform and install the Sentry SDK/)
    ).toBeInTheDocument();

    // Create first project is not skippable
    expect(
      within(screen.getByRole('button', {name: /Create your first project/})).queryByRole(
        'button',
        {name: 'Skip Task'}
      )
    ).not.toBeInTheDocument();

    // Invite your team is skippable
    expect(
      within(screen.getByRole('button', {name: /Invite your team/})).getByRole('button', {
        name: 'Skip Task',
      })
    ).toBeInTheDocument();

    // Group 2
    expect(screen.getByText('Beyond the Basics')).toBeInTheDocument();
    expect(screen.getByText('0 out of 3 tasks completed')).toBeInTheDocument();
    // This means that the group is not expanded
    expect(
      screen.queryByText(DEFAULT_BEYOND_THE_BASICS_TASKS[0]!.title)
    ).not.toBeInTheDocument();

    // Manually expand second group
    await userEvent.click(screen.getByRole('button', {name: 'Expand'}));
    // Tasks from the second group should be visible
    for (const task of DEFAULT_BEYOND_THE_BASICS_TASKS) {
      expect(await screen.findByText(task.title)).toBeInTheDocument();
    }
  });

  it('marks task as completed when task is completed', async function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/onboarding-tasks/',
      method: 'GET',
      body: {
        onboardingTasks: [{task: OnboardingTaskKey.FIRST_PROJECT, status: 'complete'}],
      },
    });

    render(<OnboardingSidebarContent onClose={jest.fn()} />, {organization});

    expect(await screen.findByText('1 out of 6 tasks completed')).toBeInTheDocument();
    expect(screen.getByTestId('icon-check-mark')).toBeInTheDocument();
  });

  it('if first group completed, second group should be expanded by default', async function () {
    render(<OnboardingSidebarContent onClose={jest.fn()} />, {
      organization: OrganizationFixture({
        onboardingTasks: DEFAULT_GETTING_STARTED_TASKS.map(task => ({
          task: task.task,
          status: 'complete',
        })),
      }),
    });

    // Group 1
    expect(await screen.findByText('Getting Started')).toBeInTheDocument();
    expect(screen.getByText('6 out of 6 tasks completed')).toBeInTheDocument();

    // Group 2
    // This means that the group is expanded
    expect(screen.getByText('Beyond the Basics')).toBeInTheDocument();
  });

  it('show skipable confirmation when skipping a task', async function () {
    const mockUpdate = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/onboarding-tasks/`,
      method: 'POST',
    });

    render(<OnboardingSidebarContent onClose={jest.fn()} />, {organization});

    // Click skip task
    await userEvent.click(
      within(screen.getByRole('button', {name: /Invite your team/})).getByRole('button', {
        name: 'Skip Task',
      })
    );

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
    await userEvent.click(
      within(screen.getByRole('button', {name: /Invite your team/})).getByRole('button', {
        name: 'Skip Task',
      })
    );

    // Click 'Just Skip'
    await userEvent.click(screen.getByRole('button', {name: 'Just Skip'}));
    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/onboarding-tasks/`,
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'skipped',
            task: OnboardingTaskKey.INVITE_MEMBER,
          }),
        })
      );
    });
  });
});
