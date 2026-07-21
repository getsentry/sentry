import {GroupFixture} from 'sentry-fixture/group';

import {renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import type {useExplorerAutofix} from 'sentry/components/events/autofix/useExplorerAutofix';
import {useAutoTriggerAutofix} from 'sentry/components/events/autofix/v3/useAutoTriggerAutofix';
import {RequestError} from 'sentry/utils/requestError/requestError';

function makeAutofix(
  overrides: Partial<ReturnType<typeof useExplorerAutofix>> = {}
): ReturnType<typeof useExplorerAutofix> {
  const base: ReturnType<typeof useExplorerAutofix> = {
    runState: null,
    startStep: jest.fn().mockResolvedValue(undefined),
    createPR: jest.fn(),
    reset: jest.fn(),
    triggerCodingAgentHandoff: jest.fn(),
    codingAgentErrors: [],
    dismissCodingAgentError: jest.fn(),
    warnings: [],
    isLoading: false,
    isPolling: false,
  };
  return {...base, ...overrides};
}

describe('useAutoTriggerAutofix', () => {
  it('starts root_cause when seerAutofixLastTriggered is set but seerExplorerAutofixLastTriggered is not', () => {
    const autofix = makeAutofix();
    const group = GroupFixture({
      seerAutofixLastTriggered: '2024-01-01T00:00:00Z',
      seerExplorerAutofixLastTriggered: null,
    });

    renderHook(() => useAutoTriggerAutofix({autofix, group}));

    expect(autofix.startStep).toHaveBeenCalledWith('root_cause');
    expect(autofix.startStep).toHaveBeenCalledTimes(1);
  });

  it('does not start root_cause when seerExplorerAutofixLastTriggered is set', () => {
    const autofix = makeAutofix();
    const group = GroupFixture({
      seerAutofixLastTriggered: '2024-01-01T00:00:00Z',
      seerExplorerAutofixLastTriggered: '2024-01-02T00:00:00Z',
    });

    renderHook(() => useAutoTriggerAutofix({autofix, group}));

    expect(autofix.startStep).not.toHaveBeenCalled();
  });

  it('does not trigger root_cause more than once on re-render', () => {
    const autofix = makeAutofix();
    const group = GroupFixture({
      seerAutofixLastTriggered: '2024-01-01T00:00:00Z',
      seerExplorerAutofixLastTriggered: null,
    });

    const {rerender} = renderHook(() => useAutoTriggerAutofix({autofix, group}));

    rerender();
    rerender();

    expect(autofix.startStep).toHaveBeenCalledTimes(1);
  });

  it('resets autofix state on 402 quota exhausted error', async () => {
    const error = new RequestError('POST', '/autofix/', new Error('test'), {
      status: 402,
      statusText: 'Payment Required',
      responseText: '{"detail": "Quota exhausted"}',
      responseJSON: {detail: 'Quota exhausted'},
      getResponseHeader: () => null,
    });

    const autofix = makeAutofix({
      startStep: jest.fn().mockRejectedValue(error),
    });
    const group = GroupFixture({
      seerAutofixLastTriggered: '2024-01-01T00:00:00Z',
      seerExplorerAutofixLastTriggered: null,
    });

    renderHook(() => useAutoTriggerAutofix({autofix, group}));

    await waitFor(() => {
      expect(autofix.reset).toHaveBeenCalled();
    });
  });

  it('catches non-402 errors without resetting', async () => {
    const error = new RequestError('POST', '/autofix/', new Error('test'), {
      status: 500,
      statusText: 'Internal Server Error',
      responseText: '{"detail": "Internal Error"}',
      responseJSON: {detail: 'Internal Error'},
      getResponseHeader: () => null,
    });

    const autofix = makeAutofix({
      startStep: jest.fn().mockRejectedValue(error),
    });
    const group = GroupFixture({
      seerAutofixLastTriggered: '2024-01-01T00:00:00Z',
      seerExplorerAutofixLastTriggered: null,
    });

    renderHook(() => useAutoTriggerAutofix({autofix, group}));

    await waitFor(() => {
      expect(autofix.startStep).toHaveBeenCalled();
    });
    expect(autofix.reset).not.toHaveBeenCalled();
  });
});
