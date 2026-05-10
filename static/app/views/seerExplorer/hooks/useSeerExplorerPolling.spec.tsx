import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {useSeerExplorerPolling} from './useSeerExplorerPolling';

describe('useSeerExplorerPolling', () => {
  const organization = OrganizationFixture({
    features: ['seer-explorer', 'gen-ai-features'],
    hideAiFeatures: false,
    openMembership: true,
  });

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it("doesn't poll on api error", async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/explorer-chat/42/`,
      statusCode: 500,
      body: {detail: 'Internal Server Error'},
    });

    const {result} = renderHookWithProviders(() => useSeerExplorerPolling({runId: 42}), {
      organization,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.isPolling).toBe(false);
    expect(result.current.errorStatusCode).toBe(500);
  });
});
