import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {TeamFixture} from 'sentry-fixture/team';

import {updateOnboardingTask} from 'sentry/actionCreators/onboardingTasks';
import {updateOrganization} from 'sentry/actionCreators/organizations';
import ConfigStore from 'sentry/stores/configStore';
import {OnboardingTaskKey} from 'sentry/types';

jest.mock('sentry/actionCreators/organizations', () => ({
  updateOrganization: jest.fn(),
}));

describe('actionCreators/onboardingTasks', function () {
  const api = new MockApiClient();
  const user = ConfigStore.get('user');

  describe('updateOnboardingTask', function () {
    it('Adds the task to the organization when task does not exists', async function () {
      const detailedOrg = OrganizationFixture({
        teams: [TeamFixture()],
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

      expect(updateOrganization).toHaveBeenCalledWith({
        onboardingTasks: [{...testTask, user}],
      });
    });

    it('Updates existing onboarding task', async function () {
      const detailedOrg = OrganizationFixture({
        teams: [TeamFixture()],
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
      expect(updateOrganization).toHaveBeenCalledWith({
        onboardingTasks: [testTask],
      });
    });

    it('Does not make API request without api object', async function () {
      const detailedOrg = OrganizationFixture({
        teams: [TeamFixture()],
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
      expect(updateOrganization).toHaveBeenCalledWith({
        onboardingTasks: [{...testTask, user}],
      });
    });
  });
});
