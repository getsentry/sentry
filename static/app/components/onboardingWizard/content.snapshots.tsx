import {OrganizationFixture} from 'sentry-fixture/organization';

import {Container} from '@sentry/scraps/layout';

import {OnboardingTaskKey, type OnboardingTask} from 'sentry/types/onboarding';

// SSR snapshot tests — no jsdom/RTL/router, so we mock hooks directly.
// oxlint-disable-next-line @sentry/scraps/no-restricted-module-mocks
jest.mock('sentry/utils/useLocation', () => ({
  useLocation: () => ({pathname: '/', query: {}, search: '', hash: ''}),
}));
// oxlint-disable-next-line @sentry/scraps/no-restricted-module-mocks
jest.mock('sentry/utils/useNavigate', () => ({useNavigate: () => () => {}}));
// oxlint-disable-next-line @sentry/scraps/no-restricted-module-mocks
jest.mock('sentry/utils/useOrganization', () => ({
  useOrganization: () => OrganizationFixture({features: ['onboarding']}),
}));
jest.mock('sentry/components/onboarding/useMutateOnboardingTasks', () => ({
  useMutateOnboardingTasks: () => ({mutate: () => {}}),
}));
jest.mock('sentry/views/navigation/navigationTour', () => ({
  useNavigationTour: () => ({startTour: () => {}}),
}));

const mockOnboardingTasks = jest.fn();
jest.mock('sentry/components/onboardingWizard/useOnboardingTasks', () => ({
  useOnboardingTasks: () => mockOnboardingTasks(),
}));

import {OnboardingSidebarContent} from './content';

function makeTask(
  task: OnboardingTaskKey,
  title: string,
  status?: OnboardingTask['status']
): OnboardingTask {
  return {
    task,
    title,
    description: 'A short description of what this task sets up for you.',
    display: true,
    skippable: true,
    actionType: 'app',
    location: '/',
    status,
  };
}

function mockTasks(
  gettingStartedTasks: OnboardingTask[],
  beyondBasicsTasks: OnboardingTask[]
) {
  const allTasks = [...gettingStartedTasks, ...beyondBasicsTasks];
  mockOnboardingTasks.mockReturnValue({
    gettingStartedTasks,
    beyondBasicsTasks,
    allTasks,
    doneTasks: allTasks.filter(task => task.status),
  });
}

function QuickStart() {
  // Mirrors the primary navigation overlay that hosts the quick start.
  return (
    <Container width="400px" padding="lg" background="primary">
      <OnboardingSidebarContent onClose={() => {}} />
    </Container>
  );
}

const completedGettingStarted = [
  makeTask(OnboardingTaskKey.FIRST_PROJECT, 'Create your first project', 'complete'),
  makeTask(OnboardingTaskKey.FIRST_EVENT, 'Capture your first error', 'complete'),
];

const partialBeyondBasics = [
  makeTask(
    OnboardingTaskKey.REAL_TIME_NOTIFICATIONS,
    'Get real-time notifications',
    'complete'
  ),
  makeTask(OnboardingTaskKey.SESSION_REPLAY, 'See a video-like reproduction', 'skipped'),
  makeTask(OnboardingTaskKey.FIRST_TRANSACTION, 'Set up Tracing'),
  makeTask(OnboardingTaskKey.SECOND_PLATFORM, 'Add Sentry to other parts of your app'),
];

const partialGettingStarted = [
  makeTask(OnboardingTaskKey.FIRST_PROJECT, 'Create your first project', 'complete'),
  makeTask(OnboardingTaskKey.FIRST_EVENT, 'Capture your first error'),
  makeTask(OnboardingTaskKey.INVITE_MEMBER, 'Invite your team'),
];

describe('OnboardingSidebarContent', () => {
  it.snapshot(
    'getting-started-in-progress',
    () => {
      mockTasks(partialGettingStarted, partialBeyondBasics);
      return <QuickStart />;
    },
    {interaction: {hover: 'text=Invite your team'}}
  );

  it.snapshot(
    'expanded-group-header-hover',
    () => {
      mockTasks(partialGettingStarted, partialBeyondBasics);
      return <QuickStart />;
    },
    // The collapse button is hidden until its header is hovered. Hover it to
    // capture the group caret in line with the task carets below it.
    {interaction: {hover: 'div:has(> [aria-label="Collapse"])'}}
  );

  it.snapshot(
    'collapsed-group-header-hover',
    () => {
      mockTasks(completedGettingStarted, partialBeyondBasics);
      return <QuickStart />;
    },
    // The expand button is hidden until its header is hovered, so hover the
    // header to capture the button against the header's hover background.
    {interaction: {hover: 'div:has(> [aria-label="Expand"])'}}
  );

  it.snapshot('all-tasks-complete', () => {
    mockTasks(completedGettingStarted, [
      makeTask(OnboardingTaskKey.FIRST_TRANSACTION, 'Set up Tracing', 'complete'),
    ]);
    return <QuickStart />;
  });
});
