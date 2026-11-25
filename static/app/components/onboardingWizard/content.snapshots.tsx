import {MemoryRouter} from 'react-router';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {Container} from '@sentry/scraps/layout';

import {OnboardingTaskKey, type OnboardingTaskStatus} from 'sentry/types/onboarding';
import type {Organization} from 'sentry/types/organization';
import {OrganizationContext} from 'sentry/utils/organizationContext';
import {NavigationTourProvider} from 'sentry/views/navigation/navigationTour';
import {PrimaryNavigationContextProvider} from 'sentry/views/navigation/primaryNavigationContext';

import {OnboardingSidebarContent} from './content';

function complete(task: OnboardingTaskKey): OnboardingTaskStatus {
  return {task, status: 'complete'};
}

function organizationWith(onboardingTasks: OnboardingTaskStatus[]) {
  return OrganizationFixture({features: ['onboarding'], onboardingTasks});
}

const GETTING_STARTED_COMPLETE = [
  complete(OnboardingTaskKey.FIRST_PROJECT),
  complete(OnboardingTaskKey.FIRST_EVENT),
  complete(OnboardingTaskKey.INVITE_MEMBER),
  complete(OnboardingTaskKey.LINK_SENTRY_TO_SOURCE_CODE),
  complete(OnboardingTaskKey.RELEASE_TRACKING),
  complete(OnboardingTaskKey.ALERT_RULE),
];

function QuickStart({organization}: {organization: Organization}) {
  // Mirrors the primary navigation overlay that hosts the quick start.
  return (
    <MemoryRouter>
      {/* Infinite gcTime keeps the query cache from scheduling cleanup timers
          that hold Jest open after the run. */}
      <QueryClientProvider
        client={new QueryClient({defaultOptions: {queries: {gcTime: Infinity}}})}
      >
        <OrganizationContext value={organization}>
          <PrimaryNavigationContextProvider>
            <NavigationTourProvider>
              <Container width="400px" padding="lg" background="primary">
                <OnboardingSidebarContent onClose={() => {}} />
              </Container>
            </NavigationTourProvider>
          </PrimaryNavigationContextProvider>
        </OrganizationContext>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe('OnboardingSidebarContent', () => {
  it.snapshot(
    'getting-started-in-progress',
    () => (
      <QuickStart
        organization={organizationWith([complete(OnboardingTaskKey.FIRST_PROJECT)])}
      />
    ),
    {interaction: {hover: 'text=Invite your team'}}
  );

  it.snapshot(
    'expanded-group-header-hover',
    () => (
      <QuickStart
        organization={organizationWith([complete(OnboardingTaskKey.FIRST_PROJECT)])}
      />
    ),
    // The collapse button is hidden until its header is hovered. Hover the
    // header to capture the group caret in line with the task carets below it.
    {interaction: {hover: 'text=Getting Started'}}
  );

  it.snapshot(
    'collapsed-group-header-hover',
    () => (
      <QuickStart
        organization={organizationWith([
          ...GETTING_STARTED_COMPLETE,
          complete(OnboardingTaskKey.REAL_TIME_NOTIFICATIONS),
          {task: OnboardingTaskKey.SECOND_PLATFORM, status: 'skipped'},
        ])}
      />
    ),
    // The expand button is hidden until its header is hovered, so hover the
    // header to capture the button against the header's hover background.
    {interaction: {hover: 'text=Beyond the Basics'}}
  );

  it.snapshot('all-tasks-complete', () => (
    <QuickStart
      organization={organizationWith([
        ...GETTING_STARTED_COMPLETE,
        complete(OnboardingTaskKey.REAL_TIME_NOTIFICATIONS),
        complete(OnboardingTaskKey.SECOND_PLATFORM),
        complete(OnboardingTaskKey.FIRST_TRANSACTION),
      ])}
    />
  ));
});
