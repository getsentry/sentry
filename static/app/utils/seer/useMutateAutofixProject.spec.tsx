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

  it('writes repos via seer/repos and settings via the bulk endpoint, skipping preferences for the Seer agent', async () => {
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
    const bulkPost = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/autofix/automation-settings/`,
      method: 'POST',
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

    await waitFor(() => expect(bulkPost).toHaveBeenCalled());
    expect(bulkPost).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({
          automatedRunStoppingPoint: 'root_cause',
          projectIds: [Number(project.id)],
        }),
      })
    );

    // The Seer agent needs no handoff, so the legacy (GitLab-incompatible)
    // preferences endpoint is never called.
    expect(prefsPost).not.toHaveBeenCalled();
  });
});
