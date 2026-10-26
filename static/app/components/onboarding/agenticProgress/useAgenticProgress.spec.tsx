import {AgenticProgressRunFixture} from 'sentry-fixture/agenticProgressRun';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {useAgenticProgress} from './useAgenticProgress';

describe('useAgenticProgress', () => {
  const run = AgenticProgressRunFixture();
  const endpoint = `/organizations/org-slug/onboarding/agent/runs/${run.runId}/`;

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('loads the current run state', async () => {
    MockApiClient.addMockResponse({url: endpoint, body: run});

    const {result} = renderHookWithProviders(
      () => useAgenticProgress({runId: run.runId}),
      {organization: {slug: 'org-slug'}}
    );

    await waitFor(() => expect(result.current.data).toEqual(run));
  });

  it('does not load a run without an identifier', () => {
    const {result} = renderHookWithProviders(() => useAgenticProgress({runId: null}), {
      organization: {slug: 'org-slug'},
    });

    expect(result.current.fetchStatus).toBe('idle');
  });
});
