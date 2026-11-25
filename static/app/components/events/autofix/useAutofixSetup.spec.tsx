import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {useAutofixSetup} from './useAutofixSetup';

describe('useAutofixSetup', () => {
  const organization = OrganizationFixture();
  const groupId = '1';

  it('reports canStartAutofix when the integration is ok', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${groupId}/autofix/setup/`,
      body: {
        integration: {ok: true, reason: null},
        billing: {hasAutofixQuota: true},
        seerReposLinked: true,
      },
    });

    const {result} = renderHookWithProviders(() => useAutofixSetup({groupId}), {
      organization,
    });

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.canStartAutofix).toBe(true);
  });

  it('does not throw when the setup data has no integration', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${groupId}/autofix/setup/`,
      body: {billing: {hasAutofixQuota: true}, seerReposLinked: false},
    });

    const {result} = renderHookWithProviders(() => useAutofixSetup({groupId}), {
      organization,
    });

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.canStartAutofix).toBe(false);
    expect(result.current.hasAutofixQuota).toBe(true);
  });
});
