import {AgenticProgressRunFixture} from 'sentry-fixture/agenticProgressRun';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {trackAnalytics} from 'sentry/utils/analytics';

import type {AgenticProgressRun} from './types';
import {useAgenticProgressRefocusAnalytics} from './useAgenticProgressRefocusAnalytics';

jest.mock('sentry/utils/analytics');

describe('useAgenticProgressRefocusAnalytics', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('records the current progress when the browser is refocused', () => {
    const organization = OrganizationFixture();
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000);
    const run = AgenticProgressRunFixture({
      runId: '019c4dfe-a5fa-79b1-b880-3ff127a87766',
      runStatus: 'active',
      stages: [
        {
          stage: 'instrument_app',
          status: 'waiting',
          eventNote: null,
          extra: null,
        },
      ],
    });

    renderHookWithProviders(() => useAgenticProgressRefocusAnalytics(run), {
      organization,
    });

    act(() => {
      window.dispatchEvent(new Event('blur'));
      now.mockReturnValue(6_000);
      window.dispatchEvent(new Event('focus'));
    });

    expect(trackAnalytics).toHaveBeenCalledWith('onboarding.agentic_progress_refocused', {
      organization,
      duration_seconds: 5,
      run_id: run.runId,
      run_status: 'active',
      stage: 'instrument_app',
      stage_status: 'waiting',
    });
  });

  it('records a blur that occurs before progress is available', () => {
    const organization = OrganizationFixture();
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000);
    const run = AgenticProgressRunFixture();
    const {rerender} = renderHookWithProviders(
      (currentRun: AgenticProgressRun | undefined) =>
        useAgenticProgressRefocusAnalytics(currentRun),
      {initialProps: undefined, organization}
    );

    act(() => {
      window.dispatchEvent(new Event('blur'));
    });

    rerender(run);

    act(() => {
      now.mockReturnValue(6_000);
      window.dispatchEvent(new Event('focus'));
    });

    expect(trackAnalytics).toHaveBeenCalledWith('onboarding.agentic_progress_refocused', {
      organization,
      duration_seconds: 5,
      run_id: run.runId,
      run_status: run.runStatus,
      stage: 'connect_mcp',
      stage_status: null,
    });
  });
});
