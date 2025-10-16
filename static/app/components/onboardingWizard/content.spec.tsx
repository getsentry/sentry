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
import {NavContextProvider} from 'sentry/views/nav/context';
import {NavigationTourProvider} from 'sentry/views/nav/tour/tour';

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

describe('OnboardingSidebarContent', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/onboarding-tasks/',
      method: 'GET',
      body: {
        onboardingTasks: [],
      },
    });
    MockApiClient.addMockResponse({
      url: `/assistant/`,
      body: [],
    });
  });

  it('should render the sidebar with the correct groups and tasks', async () => {
    render(
      <NavContextProvider>
        <NavigationTourProvider>
          <OnboardingSidebarContent onClose={jest.fn()} />
        </NavigationTourProvider>
      </NavContextProvider>,
      {organization}
    );
    expect(await screen.findByText('Getting Started')).toBeInTheDocument();
    expect(screen.getByText('0 out of 6 tasks completed')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Collapse'})).toBeInTheDocument();
    for (const task of DEFAULT_GETTING_STARTED_TASKS) {
      expect(
        screen.getByRole('button', {name: new RegExp(task.title)})
      ).toBeInTheDocument();
    }
    expect(
      screen.getByText(/Select your platform and install the Sentry SDK/)
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('button', {name: /Create your first project/})).queryByRole(
        'button',
        {name: 'Skip Task'}
      )
    ).not.toBeInTheDocument();
    expect(
      within(screen.getByRole('button', {name: /Invite your team/})).getByRole('button', {
        name: 'Skip Task',
      })
    ).toBeInTheDocument();
    expect(screen.getByText('Beyond the Basics')).toBeInTheDocument();
    expect(screen.getByText('0 out of 3 tasks completed')).toBeInTheDocument();
    expect(
      screen.queryByText(DEFAULT_BEYOND_THE_BASICS_TASKS[0]!.title)
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Expand'}));
    for (const task of DEFAULT_BEYOND_THE_BASICS_TASKS) {
      expect(await screen.findByText(task.title)).toBeInTheDocument();
    }
  });

  it('marks task as completed when task is completed', async () => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/onboarding-tasks/',
      method: 'GET',
      body: {
        onboardingTasks: [{task: OnboardingTaskKey.FIRST_PROJECT, status: 'complete'}],
      },
    });
    MockApiClient.addMockResponse({
      url: `/assistant/`,
      body: [],
    });

    render(
      <NavContextProvider>
        <NavigationTourProvider>
          <OnboardingSidebarContent onClose={jest.fn()} />
        </NavigationTourProvider>
      </NavContextProvider>,
      {organization}
    );

    expect(await screen.findByText('1 out of 6 tasks completed')).toBeInTheDocument();
    expect(screen.getByTestId('icon-check-mark')).toBeInTheDocument();
  });

  it('if first group completed, second group should be expanded by default', async () => {
    render(
      <NavContextProvider>
        <NavigationTourProvider>
          <OnboardingSidebarContent onClose={jest.fn()} />
        </NavigationTourProvider>
      </NavContextProvider>,
      {
        organization: OrganizationFixture({
          onboardingTasks: DEFAULT_GETTING_STARTED_TASKS.map(task => ({
            task: task.task,
            status: 'complete',
          })),
        }),
      }
    );

    expect(await screen.findByText('Getting Started')).toBeInTheDocument();
    expect(screen.getByText('6 out of 6 tasks completed')).toBeInTheDocument();

    expect(screen.getByText('Beyond the Basics')).toBeInTheDocument();
  });

  it('show skipable confirmation when skipping a task', async () => {
    const mockUpdate = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/onboarding-tasks/`,
      method: 'POST',
    });

    render(
      <NavContextProvider>
        <NavigationTourProvider>
          <OnboardingSidebarContent onClose={jest.fn()} />
        </NavigationTourProvider>
      </NavContextProvider>,
      {organization}
    );

    await userEvent.click(
      within(screen.getByRole('button', {name: /Invite your team/})).getByRole('button', {
        name: 'Skip Task',
      })
    );

    expect(await screen.findByText(/Not sure what to do/)).toBeInTheDocument();
    const contactSupportButton = screen.getByRole('button', {name: /contact support/i});
    expect(contactSupportButton).toHaveAttribute('href', 'https://sentry.io/support/');
    expect(contactSupportButton).toHaveAttribute('target', '_blank');

    await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));
    expect(screen.queryByText(/Not sure what to do/)).not.toBeInTheDocument();

    await userEvent.click(
      within(screen.getByRole('button', {name: /Invite your team/})).getByRole('button', {
        name: 'Skip Task',
      })
    );

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
