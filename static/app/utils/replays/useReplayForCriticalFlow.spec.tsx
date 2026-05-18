import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {HookStore} from 'sentry/stores/hookStore';
import {useReplayForCriticalFlow} from 'sentry/utils/replays/useReplayForCriticalFlow';

describe('useReplayForCriticalFlow', () => {
  afterEach(() => {
    HookStore.init();
  });

  it('delegates to the registered hook implementation', () => {
    const impl = jest.fn();
    HookStore.add('react-hook:use-replay-for-critical-flow', impl);

    renderHookWithProviders(() =>
      useReplayForCriticalFlow({flowName: 'scm_onboarding', sampleRate: 0.5})
    );

    expect(impl).toHaveBeenCalledWith({flowName: 'scm_onboarding', sampleRate: 0.5});
  });

  it('is a noop when no implementation is registered (self-hosted)', () => {
    expect(() =>
      renderHookWithProviders(() =>
        useReplayForCriticalFlow({flowName: 'scm_onboarding'})
      )
    ).not.toThrow();
  });
});
