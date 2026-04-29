import * as Sentry from '@sentry/react';

import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {useReplayForCriticalFlow} from 'getsentry/utils/replays/useReplayForCriticalFlow';

describe('useReplayForCriticalFlow', () => {
  const flush = jest.fn();
  const setTag = Sentry.setTag as jest.Mock;
  const getReplay = Sentry.getReplay as jest.Mock;
  const originalRandom = Math.random;

  beforeEach(() => {
    flush.mockReset();
    setTag.mockReset();
    getReplay.mockReset();
  });

  afterEach(() => {
    Math.random = originalRandom;
  });

  it('tags and flushes when enabled and replay is registered', () => {
    getReplay.mockReturnValue({flush});

    const {unmount} = renderHookWithProviders(() =>
      useReplayForCriticalFlow({flowName: 'scm_onboarding'})
    );

    expect(setTag).toHaveBeenCalledWith('critical_flow', 'scm_onboarding');
    expect(flush).toHaveBeenCalledTimes(1);

    unmount();

    expect(flush).toHaveBeenCalledTimes(2);
    expect(setTag).toHaveBeenLastCalledWith('critical_flow', undefined);
  });

  it('forces a replay when the mount falls within sampleRate', () => {
    getReplay.mockReturnValue({flush});
    Math.random = () => 0.1;

    renderHookWithProviders(() =>
      useReplayForCriticalFlow({flowName: 'scm_onboarding', sampleRate: 0.3})
    );

    expect(flush).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the mount falls outside sampleRate', () => {
    getReplay.mockReturnValue({flush});
    Math.random = () => 0.5;

    renderHookWithProviders(() =>
      useReplayForCriticalFlow({flowName: 'scm_onboarding', sampleRate: 0.3})
    );

    expect(getReplay).not.toHaveBeenCalled();
    expect(setTag).not.toHaveBeenCalled();
    expect(flush).not.toHaveBeenCalled();
  });

  it('does nothing when disabled', () => {
    getReplay.mockReturnValue({flush});

    renderHookWithProviders(() =>
      useReplayForCriticalFlow({flowName: 'scm_onboarding', enabled: false})
    );

    expect(getReplay).not.toHaveBeenCalled();
    expect(setTag).not.toHaveBeenCalled();
    expect(flush).not.toHaveBeenCalled();
  });

  it('does nothing when the replay integration is not registered', () => {
    getReplay.mockReturnValue(undefined);

    renderHookWithProviders(() => useReplayForCriticalFlow({flowName: 'scm_onboarding'}));

    expect(setTag).not.toHaveBeenCalled();
    expect(flush).not.toHaveBeenCalled();
  });
});
