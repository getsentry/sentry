import * as Sentry from '@sentry/react';

import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {useReplayForCriticalFlow} from 'sentry/utils/replays/useReplayForCriticalFlow';

describe('useReplayForCriticalFlow', () => {
  const flush = jest.fn();
  const setTag = Sentry.setTag as jest.Mock;
  const getReplay = Sentry.getReplay as jest.Mock;

  beforeEach(() => {
    flush.mockReset();
    setTag.mockReset();
    getReplay.mockReset();
  });

  // Math.random() returns [0, 1), so sampleRate=1 always forces, sampleRate=0
  // never forces. That gives deterministic coverage of both gate paths
  // without mocking Math.random.

  it('tags and flushes at the default sampleRate of 1', () => {
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

  it('does nothing when sampleRate is 0', () => {
    getReplay.mockReturnValue({flush});

    renderHookWithProviders(() =>
      useReplayForCriticalFlow({flowName: 'scm_onboarding', sampleRate: 0})
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
