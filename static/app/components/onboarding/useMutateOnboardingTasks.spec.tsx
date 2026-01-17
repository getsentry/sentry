import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {useMutateOnboardingTasks} from 'sentry/components/onboarding/useMutateOnboardingTasks';
import OrganizationStore from 'sentry/stores/organizationStore';
import {OnboardingTaskKey} from 'sentry/types/onboarding';

describe('useMutateOnboardingTasks', () => {
  jest.spyOn(OrganizationStore, 'onUpdate');

  it('Updates existing onboarding tasks', async () => {
    const organization = OrganizationFixture({
      onboardingTasks: [
        {
          task: OnboardingTaskKey.FIRST_EVENT,
        },
      ],
    });

    const testTask = {
      task: OnboardingTaskKey.FIRST_EVENT,
      status: 'complete',
    } as const;

    const mockUpdate = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/onboarding-tasks/`,
      method: 'POST',
      body: testTask,
    });

    const {result} = renderHookWithProviders(useMutateOnboardingTasks, {
      organization,
    });

    result.current.mutate([testTask]);

    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());

    expect(OrganizationStore.onUpdate).toHaveBeenCalledWith({
      onboardingTasks: [testTask],
    });
  });
});
