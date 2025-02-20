import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {PrimaryNavigationOnboarding} from 'sentry/components/nav/primary/onboarding';
import ConfigStore from 'sentry/stores/configStore';
import {OnboardingTaskKey} from 'sentry/types/onboarding';
import type {Organization} from 'sentry/types/organization';
import * as useOnboardingSidebar from 'sentry/views/onboarding/useOnboardingSidebar';

const userMock = UserFixture();

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
    ConfigStore.set(
      'user',
      UserFixture({
        options: {...userMock.options, quickStartDisplay: {[organizationId]: 2}},
      })
    );
  });

  it('panel is collapsed and has pending tasks to be seen', async function () {
    const organization = OrganizationFixture({
      id: organizationId,
      features: ['onboarding'],
      onboardingTasks: [
        {
          task: OnboardingTaskKey.FIRST_PROJECT,
          status: 'complete',
          user: UserFixture(),
          completionSeen: undefined,
          dateCompleted: undefined,
        },
      ],
    });

    const {mutateUserOptionsMock, getOnboardingTasksMock} =
      renderMockRequests(organization);

    render(<PrimaryNavigationOnboarding />, {
      organization,
    });

    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByTestId('pending-seen-indicator')).toBeInTheDocument();
    expect(mutateUserOptionsMock).not.toHaveBeenCalled();

    // By hovering over the button, we should refetch the data
    await userEvent.hover(screen.getByRole('button', {name: 'Onboarding'}));
    await waitFor(() => expect(getOnboardingTasksMock).toHaveBeenCalled());

    // Open the panel
    await userEvent.click(screen.getByRole('button', {name: 'Onboarding'}));
    await waitFor(() => expect(getOnboardingTasksMock).toHaveBeenCalled());
  });

  it("panel is not automatically expanded because the user option 'quickStartDisplay' is not set", async function () {
    ConfigStore.set(
      'user',
      UserFixture({
        options: {...userMock.options, quickStartDisplay: {}},
      })
    );

    const organization = OrganizationFixture({
      id: organizationId,
      features: ['onboarding'],
    });

    const {mutateUserOptionsMock} = renderMockRequests(organization);

    const mockActivateSidebar = jest.fn();

    jest.spyOn(useOnboardingSidebar, 'useOnboardingSidebar').mockReturnValue({
      activateSidebar: mockActivateSidebar,
    });

    render(<PrimaryNavigationOnboarding />, {
      organization,
    });

    await waitFor(() =>
      expect(mutateUserOptionsMock).toHaveBeenCalledWith(
        '/users/me/',
        expect.objectContaining({
          data: {
            options: {quickStartDisplay: {[organizationId]: 1}},
          },
        })
      )
    );

    expect(mockActivateSidebar).not.toHaveBeenCalled();
  });

  it("panel is automatically expanded because the user option 'quickStartDisplay' is set to 1", async function () {
    ConfigStore.set(
      'user',
      UserFixture({
        options: {...userMock.options, quickStartDisplay: {[organizationId]: 1}},
      })
    );

    const organization = OrganizationFixture({
      id: organizationId,
      features: ['onboarding'],
    });

    const {mutateUserOptionsMock} = renderMockRequests(organization);

    const mockActivateSidebar = jest.fn();

    jest.spyOn(useOnboardingSidebar, 'useOnboardingSidebar').mockReturnValue({
      activateSidebar: mockActivateSidebar,
    });

    render(<PrimaryNavigationOnboarding />, {
      organization,
    });

    await waitFor(() =>
      expect(mutateUserOptionsMock).toHaveBeenCalledWith(
        '/users/me/',
        expect.objectContaining({
          data: {
            options: {quickStartDisplay: {[organizationId]: 2}},
          },
        })
      )
    );

    expect(mockActivateSidebar).toHaveBeenCalled();
  });
});
