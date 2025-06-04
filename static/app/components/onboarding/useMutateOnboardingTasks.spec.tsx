import {OrganizationFixture} from 'sentry-fixture/organization';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import {useMutateOnboardingTasks} from 'sentry/components/onboarding/useMutateOnboardingTasks';
import OrganizationStore from 'sentry/stores/organizationStore';
import {OnboardingTaskKey} from 'sentry/types/onboarding';
import {QueryClientProvider} from 'sentry/utils/queryClient';
import {OrganizationContext} from 'sentry/views/organizationContext';

describe('useMutateOnboardingTasks', function () {
  jest.spyOn(OrganizationStore, 'onUpdate');

  it('Updates existing onboarding tasks', async function () {
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

    const {result} = renderHook(() => useMutateOnboardingTasks(), {
      wrapper: ({children}) => (
        <OrganizationContext value={organization}>
          <QueryClientProvider client={makeTestQueryClient()}>
            {children}
          </QueryClientProvider>
        </OrganizationContext>
      ),
    });

    result.current.mutate([testTask]);

    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());

    expect(OrganizationStore.onUpdate).toHaveBeenCalledWith({
      onboardingTasks: [testTask],
    });
  });
});
