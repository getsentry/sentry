import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {registerHook} from 'sentry/hookRegistry';
import {useReplayForCriticalFlow} from 'sentry/utils/replays/useReplayForCriticalFlow';

describe('useReplayForCriticalFlow', () => {
  it('delegates to the registered hook implementation', () => {
    const impl = jest.fn();
    registerHook('react-hook:use-replay-for-critical-flow', impl);

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
