import {updateOnboardingTask} from 'app/actionCreators/onboardingTasks';
import OrganizationActions from 'app/actions/organizationActions';
import ConfigStore from 'app/stores/configStore';

describe('actionCreators/onboardingTasks', function () {
  const api = new MockApiClient();
  const user = ConfigStore.get('user');

  jest.spyOn(OrganizationActions, 'update');

  describe('updateOnboardingTask', function () {
    it('Adds the task to the organization when task does not exists', async function () {
      const detailedOrg = TestStubs.Organization({
        teams: [TestStubs.Team()],
        projects: [TestStubs.Project()],
      });

      // User is not passed into the update request
      const testTask = {
        task: 'create_project',
        status: 'complete',
      };

      const mockUpdate = MockApiClient.addMockResponse({
        url: `/organizations/${detailedOrg.slug}/onboarding-tasks/`,
        method: 'POST',
        body: testTask,
      });

      updateOnboardingTask(api, detailedOrg, testTask);
      await tick();

      expect(mockUpdate).toHaveBeenCalled();

      expect(OrganizationActions.update).toHaveBeenCalledWith({
        onboardingTasks: [{...testTask, user}],
      });
    });

    it('Updates existing onboarding task', async function () {
      const detailedOrg = TestStubs.Organization({
        teams: [TestStubs.Team()],
        projects: [TestStubs.Project()],
        onboardingTasks: [{task: 'first_event', status: 'skipped'}],
      });

      const testTask = {
        task: 'first_event',
        status: 'complete',
      };

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
      expect(OrganizationActions.update).toHaveBeenCalledWith({
        onboardingTasks: [testTask],
      });
    });

    it('Does not make API request without api object', async function () {
      const detailedOrg = TestStubs.Organization({
        teams: [TestStubs.Team()],
        projects: [TestStubs.Project()],
      });

      const testTask = {
        task: 'first_event',
        status: 'complete',
      };

      const mockUpdate = MockApiClient.addMockResponse({
        url: `/organizations/${detailedOrg.slug}/onboarding-tasks/`,
        method: 'POST',
      });

      updateOnboardingTask(null, detailedOrg, testTask);
      await tick();

      expect(mockUpdate).not.toHaveBeenCalled();
      expect(OrganizationActions.update).toHaveBeenCalledWith({
        onboardingTasks: [{...testTask, user}],
      });
    });
  });
});
