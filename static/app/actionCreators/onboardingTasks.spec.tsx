import {Organization} from 'sentry-fixture/organization';
import {Project as ProjectFixture} from 'sentry-fixture/project';
import {Team} from 'sentry-fixture/team';

import {updateOnboardingTask} from 'sentry/actionCreators/onboardingTasks';
import ConfigStore from 'sentry/stores/configStore';
import OrganizationStore from 'sentry/stores/organizationStore';
import {OnboardingTaskKey} from 'sentry/types';

describe('actionCreators/onboardingTasks', function () {
  const api = new MockApiClient();
  const user = ConfigStore.get('user');

  jest.spyOn(OrganizationStore, 'onUpdate');

  describe('updateOnboardingTask', function () {
    it('Adds the task to the organization when task does not exists', async function () {
      const detailedOrg = Organization({
        teams: [Team()],
        projects: [ProjectFixture()],
      });

      // User is not passed into the update request
      const testTask = {
        task: OnboardingTaskKey.FIRST_PROJECT,
        status: 'complete',
      } as const;

      const mockUpdate = MockApiClient.addMockResponse({
        url: `/organizations/${detailedOrg.slug}/onboarding-tasks/`,
        method: 'POST',
        body: testTask,
      });

      updateOnboardingTask(api, detailedOrg, testTask);
      await tick();

      expect(mockUpdate).toHaveBeenCalled();

      expect(OrganizationStore.onUpdate).toHaveBeenCalledWith({
        onboardingTasks: [{...testTask, user}],
      });
    });

    it('Updates existing onboarding task', async function () {
      const detailedOrg = Organization({
        teams: [Team()],
        projects: [ProjectFixture()],
        onboardingTasks: [{task: OnboardingTaskKey.FIRST_EVENT, status: 'skipped'}],
      });

      const testTask = {
        task: OnboardingTaskKey.FIRST_EVENT,
        status: 'complete',
      } as const;

      MockApiClient.clearMockResponses();
      const mockUpdate = MockApiClient.addMockResponse({
        url: `/organizations/${detailedOrg.slug}/onboarding-tasks/`,
        method: 'POST',
        body: testTask,
      });

      updateOnboardingTask(api, detailedOrg, testTask);
      await tick();

      expect(mockUpdate).toHaveBeenCalled();

      // NOTE: user is not passed as it is already associated to the existing
      // onboarding task.
      expect(OrganizationStore.onUpdate).toHaveBeenCalledWith({
        onboardingTasks: [testTask],
      });
    });

    it('Does not make API request without api object', async function () {
      const detailedOrg = Organization({
        teams: [Team()],
        projects: [ProjectFixture()],
      });

      const testTask = {
        task: OnboardingTaskKey.FIRST_EVENT,
        status: 'complete',
      } as const;

      const mockUpdate = MockApiClient.addMockResponse({
        url: `/organizations/${detailedOrg.slug}/onboarding-tasks/`,
        method: 'POST',
      });

      updateOnboardingTask(null, detailedOrg, testTask);
      await tick();

      expect(mockUpdate).not.toHaveBeenCalled();
      expect(OrganizationStore.onUpdate).toHaveBeenCalledWith({
        onboardingTasks: [{...testTask, user}],
      });
    });
  });
});
