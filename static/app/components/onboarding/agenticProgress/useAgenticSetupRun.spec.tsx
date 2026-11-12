import {useState} from 'react';
import {AgenticProgressRunFixture} from 'sentry-fixture/agenticProgressRun';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  act,
  cleanup,
  renderHookWithProviders,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import type {AgenticRunSession} from './types';
import {useAgenticSetupRun} from './useAgenticSetupRun';

describe('useAgenticSetupRun', () => {
  const organization = OrganizationFixture();
  const initialRun = AgenticProgressRunFixture();
  const endpoint = `/organizations/${organization.slug}/onboarding/agent/runs/`;

  afterEach(async () => {
    try {
      cleanup();
      await act(async () => {
        await jest.runOnlyPendingTimersAsync();
      });
    } finally {
      jest.useRealTimers();
      MockApiClient.clearMockResponses();
    }
  });

  it('polls live progress and resumes the same run after the host pauses it', async () => {
    jest.useFakeTimers();
    const initializationRequest = MockApiClient.addMockResponse({
      url: endpoint,
      method: 'POST',
      body: initialRun,
    });
    const liveRun = AgenticProgressRunFixture({
      stages: [
        {stage: 'connect_mcp', status: 'completed', eventNote: null, extra: null},
        {stage: 'instrument_app', status: 'active', eventNote: null, extra: null},
      ],
    });
    const progressRequest = MockApiClient.addMockResponse({
      url: `${endpoint}${initialRun.runId}/`,
      body: liveRun,
    });

    const {result, rerender} = renderHookWithProviders(
      ({enabled}: {enabled: boolean}) => {
        const [session, setSession] = useState<AgenticRunSession>();

        return useAgenticSetupRun({enabled, session, onSessionChange: setSession});
      },
      {organization, initialProps: {enabled: true}}
    );

    await waitFor(() => expect(result.current.run).toEqual(liveRun));
    expect(result.current.isAgentConnected).toBe(true);
    expect(progressRequest).toHaveBeenCalledTimes(1);

    await act(() => jest.advanceTimersByTimeAsync(5_000));
    expect(progressRequest).toHaveBeenCalledTimes(2);

    rerender({enabled: false});
    await act(() => jest.advanceTimersByTimeAsync(15_000));
    expect(progressRequest).toHaveBeenCalledTimes(2);

    rerender({enabled: true});
    await waitFor(() => expect(progressRequest).toHaveBeenCalledTimes(3));
    expect(result.current.run).toEqual(liveRun);
    expect(initializationRequest).toHaveBeenCalledTimes(1);
  });
});
