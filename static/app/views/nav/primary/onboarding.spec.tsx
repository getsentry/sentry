import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {OnboardingTaskKey} from 'sentry/types/onboarding';
import type {Organization} from 'sentry/types/organization';
import {PrimaryNavigationOnboarding} from 'sentry/views/nav/primary/onboarding';

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

describe('Onboarding Status', function () {
  const organizationId = OrganizationFixture().id;

  beforeEach(function () {
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
  });

  it('displays pending tasks', async function () {
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

    render(<PrimaryNavigationOnboarding />, {
      organization,
    });

    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByTestId('pending-seen-indicator')).toBeInTheDocument();
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
      expect(screen.queryByTestId('pending-seen-indicator')).not.toBeInTheDocument()
    );
  });
});
