import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {OnboardingTaskKey} from 'sentry/types/onboarding';
import type {Organization} from 'sentry/types/organization';
import {NavigationTourProvider} from 'sentry/views/navigation/navigationTour';
import {PrimaryNavigationOnboarding} from 'sentry/views/navigation/primary/onboarding';
import {PrimaryNavigationContextProvider} from 'sentry/views/navigation/primaryNavigationContext';

jest.mock('framer-motion', () => ({
  ...jest.requireActual('framer-motion'),
  AnimatePresence: jest.fn(({children}) => children),
}));

function renderMockRequests(organization: Organization) {
  const getOnboardingTasksMock = MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/onboarding-tasks/`,
    method: 'GET',
    body: {
      onboardingTasks: organization.onboardingTasks,
    },
  });

  const mutateUserOptionsMock = MockApiClient.addMockResponse({
    url: `/users/me/`,
    method: 'PUT',
  });

  return {getOnboardingTasksMock, mutateUserOptionsMock};
}

describe('Onboarding Status', () => {
  const organizationId = OrganizationFixture().id;

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
      url: '/organizations/org-slug/onboarding-tasks/',
      method: 'POST',
    });

    MockApiClient.addMockResponse({
      url: `/assistant/`,
      body: [],
    });
  });

  it('displays pending tasks', async () => {
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

    const {mutateUserOptionsMock} = renderMockRequests(organization);

    render(
      <PrimaryNavigationContextProvider>
        <NavigationTourProvider>
          <PrimaryNavigationOnboarding />
        </NavigationTourProvider>
      </PrimaryNavigationContextProvider>,
      {
        organization,
      }
    );

    expect(screen.getByText('1')).toBeInTheDocument();
    const onboardingButton = screen.getByRole('button', {name: 'Onboarding'});
    expect(onboardingButton.querySelector('[data-unread-indicator]')).toBeInTheDocument();
    expect(mutateUserOptionsMock).not.toHaveBeenCalled();

    // Next fetch should return the task as seen
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/onboarding-tasks/`,
      method: 'GET',
      body: {
        onboardingTasks: [
          {
            task: OnboardingTaskKey.FIRST_PROJECT,
            status: 'complete',
            user: UserFixture(),
            completionSeen: '2025-01-01T00:00:00Z',
            dateCompleted: undefined,
          },
        ],
      },
    });

    // Open the overlay
    await userEvent.click(screen.getByRole('button', {name: 'Onboarding'}));

    // Pending indicator should go away
    await waitFor(() =>
      expect(
        onboardingButton.querySelector('[data-unread-indicator]')
      ).not.toBeInTheDocument()
    );
  });
});
