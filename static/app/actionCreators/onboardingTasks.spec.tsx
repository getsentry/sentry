import {OrganizationFixture} from 'sentry-fixture/organization';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import {useUpdateOnboardingTasks} from 'sentry/actionCreators/onboardingTasks';
import OrganizationStore from 'sentry/stores/organizationStore';
import {OnboardingTaskKey} from 'sentry/types/onboarding';
import {QueryClientProvider} from 'sentry/utils/queryClient';
import {OrganizationContext} from 'sentry/views/organizationContext';

describe('actionCreators/onboardingTasks', function () {
  jest.spyOn(OrganizationStore, 'onUpdate');

  describe('useUpdateOnboardingTasks', function () {
    it('Updates existing onboarding tasks', async function () {
      const organization = OrganizationFixture({
        onboardingTasks: [
          {
            task: OnboardingTaskKey.FIRST_EVENT,
            status: 'pending',
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

      const {result} = renderHook(() => useUpdateOnboardingTasks(), {
        wrapper: ({children}) => (
          <OrganizationContext.Provider value={organization}>
            <QueryClientProvider client={makeTestQueryClient()}>
              {children}
            </QueryClientProvider>
          </OrganizationContext.Provider>
        ),
      });

      result.current.mutate([testTask]);

      await waitFor(() => expect(mockUpdate).toHaveBeenCalled());

      expect(OrganizationStore.onUpdate).toHaveBeenCalledWith({
        onboardingTasks: [testTask],
      });
    });
  });
});
