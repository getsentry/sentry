import {AgenticProgressRunFixture} from 'sentry-fixture/agenticProgressRun';

import {
  act,
  cleanup,
  renderHookWithProviders,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

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

  describe('polling', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(async () => {
      try {
        cleanup();
        await act(() => jest.runOnlyPendingTimersAsync());
      } finally {
        jest.useRealTimers();
      }
    });

    it('keeps polling while the run accepts updates', async () => {
      const request = MockApiClient.addMockResponse({url: endpoint, body: run});

      renderHookWithProviders(() => useAgenticProgress({runId: run.runId}), {
        organization: {slug: 'org-slug'},
      });

      await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
      await act(() => jest.advanceTimersByTimeAsync(5000));
      expect(request).toHaveBeenCalledTimes(2);
    });

    it('stops polling once the run is finished', async () => {
      const request = MockApiClient.addMockResponse({
        url: endpoint,
        body: AgenticProgressRunFixture({runStatus: 'completed', continueUpdates: false}),
      });

      renderHookWithProviders(() => useAgenticProgress({runId: run.runId}), {
        organization: {slug: 'org-slug'},
      });

      await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
      await act(() => jest.advanceTimersByTimeAsync(15000));
      expect(request).toHaveBeenCalledTimes(1);
    });
  });
});
