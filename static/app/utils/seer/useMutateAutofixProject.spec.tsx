import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {useMutateAutofixProject} from 'sentry/utils/seer/useMutateAutofixProject';

describe('useMutateAutofixProject', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture();

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('writes repos via seer/repos and project settings via seer/settings', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/coding-agents/`,
      method: 'GET',
      body: {integrations: []},
    });
    const reposPut = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/seer/repos/`,
      method: 'PUT',
      status: 204,
    });
    const settingsPut = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/seer/settings/`,
      method: 'PUT',
      status: 204,
    });
    const prefsPost = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/seer/preferences/`,
      method: 'POST',
      status: 204,
    });

    const {result} = renderHookWithProviders(useMutateAutofixProject, {organization});

    result.current.mutate({
      project,
      repoEntries: [{repoId: '7', branch: 'main'}],
      agentOption: 'seer',
      stoppingPoint: 'root_cause',
    });

    await waitFor(() => expect(reposPut).toHaveBeenCalled());
    expect(reposPut).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({data: {repos: [{repositoryId: 7, branchName: 'main'}]}})
    );

    await waitFor(() => expect(settingsPut).toHaveBeenCalled());
    expect(settingsPut).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({
          agent: 'seer',
          automationTuning: 'medium',
          stoppingPoint: 'root_cause',
        }),
      })
    );

    // The legacy preferences endpoint is GitLab-incompatible for nested groups,
    // so the modal save path should avoid it.
    expect(prefsPost).not.toHaveBeenCalled();
  });
});
