import {GroupFixture} from 'sentry-fixture/group';

import {renderHook} from 'sentry-test/reactTestingLibrary';

import type {useExplorerAutofix} from 'sentry/components/events/autofix/useExplorerAutofix';
import {useAutoTriggerAutofix} from 'sentry/components/events/autofix/v3/useAutoTriggerAutofix';

function makeAutofix(
  overrides: Partial<ReturnType<typeof useExplorerAutofix>> = {}
): ReturnType<typeof useExplorerAutofix> {
  const base: ReturnType<typeof useExplorerAutofix> = {
    runState: null,
    autofixFormatted: null,
    startStep: jest.fn(),
    createPR: jest.fn(),
    reset: jest.fn(),
    triggerCodingAgentHandoff: jest.fn(),
    codingAgentErrors: [],
    dismissCodingAgentError: jest.fn(),
    warnings: [],
    isLoading: false,
    isWaitingForRun: false,
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

  it('does not start root_cause when an explorer autofix run already exists', () => {
    const autofix = makeAutofix({
      runState: {
        run_id: 1,
        blocks: [],
        status: 'processing',
        updated_at: '2024-01-02T00:00:00Z',
      },
    });
    const group = GroupFixture({
      seerAutofixLastTriggered: '2024-01-01T00:00:00Z',
      seerExplorerAutofixLastTriggered: null,
    });

    renderHook(() => useAutoTriggerAutofix({autofix, group}));

    expect(autofix.startStep).not.toHaveBeenCalled();
  });

  it('waits for explorer autofix state to load before triggering', () => {
    const startStep = jest.fn();
    let autofix = makeAutofix({isLoading: true, startStep});
    const group = GroupFixture({
      seerAutofixLastTriggered: '2024-01-01T00:00:00Z',
      seerExplorerAutofixLastTriggered: null,
    });

    const {rerender} = renderHook(() => useAutoTriggerAutofix({autofix, group}));

    expect(startStep).not.toHaveBeenCalled();

    autofix = makeAutofix({isLoading: false, startStep});
    rerender();

    expect(startStep).toHaveBeenCalledWith('root_cause');
    expect(startStep).toHaveBeenCalledTimes(1);
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
});
