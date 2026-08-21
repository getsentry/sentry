import {act, renderHook} from 'sentry-test/reactTestingLibrary';

import {
  clearEventContextFocus,
  focusEventContextRows,
  HIGHLIGHT_DURATION_MS,
  useEventContextFocus,
} from 'sentry/components/events/eventContextTimeline/eventContextFocus';
import {SectionKey} from 'sentry/views/issueDetails/context';

describe('eventContextFocus', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    clearEventContextFocus();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('reports the focused ids to the section that was addressed', () => {
    const {result} = renderHook(() => useEventContextFocus(SectionKey.LOGS));

    act(() => focusEventContextRows(SectionKey.LOGS, ['log-1', 'log-2']));

    expect(result.current.ids).toEqual(['log-1', 'log-2']);
  });

  it('reports no ids to a section that was not addressed', () => {
    const {result} = renderHook(() => useEventContextFocus(SectionKey.METRICS));

    act(() => focusEventContextRows(SectionKey.LOGS, ['log-1']));

    expect(result.current.ids).toEqual([]);
    expect(result.current.pulse).toBe(0);
  });

  it('drops the highlight once the duration elapses', () => {
    const {result} = renderHook(() => useEventContextFocus(SectionKey.LOGS));
    act(() => focusEventContextRows(SectionKey.LOGS, ['log-1']));

    act(() => jest.advanceTimersByTime(HIGHLIGHT_DURATION_MS - 1));
    expect(result.current.ids).toEqual(['log-1']);

    act(() => jest.advanceTimersByTime(1));
    expect(result.current.ids).toEqual([]);
  });

  it('bumps the pulse when the same rows are addressed again', () => {
    const {result} = renderHook(() => useEventContextFocus(SectionKey.LOGS));

    act(() => focusEventContextRows(SectionKey.LOGS, ['log-1']));
    const firstPulse = result.current.pulse;
    act(() => focusEventContextRows(SectionKey.LOGS, ['log-1']));

    expect(result.current.ids).toEqual(['log-1']);
    expect(result.current.pulse).toBeGreaterThan(firstPulse);
  });

  it('restarts the countdown when the same rows are addressed again', () => {
    const {result} = renderHook(() => useEventContextFocus(SectionKey.LOGS));
    act(() => focusEventContextRows(SectionKey.LOGS, ['log-1']));

    act(() => jest.advanceTimersByTime(HIGHLIGHT_DURATION_MS - 1));
    act(() => focusEventContextRows(SectionKey.LOGS, ['log-1']));
    act(() => jest.advanceTimersByTime(HIGHLIGHT_DURATION_MS - 1));

    expect(result.current.ids).toEqual(['log-1']);
  });

  it('treats a section addressed with no rows as clearing, not as a pulse', () => {
    const logs = renderHook(() => useEventContextFocus(SectionKey.LOGS));
    const breadcrumbs = renderHook(() => useEventContextFocus(SectionKey.BREADCRUMBS));
    act(() => focusEventContextRows(SectionKey.LOGS, ['log-1']));

    act(() => focusEventContextRows(SectionKey.BREADCRUMBS, []));

    expect(logs.result.current.ids).toEqual([]);
    // Breadcrumbs has no addressable rows, so it must not take the focus either — a
    // section keyed on `pulse` would otherwise replay its animation for this click.
    expect(breadcrumbs.result.current.pulse).toBe(0);
  });

  it('stops a pending clear from wiping a newer highlight', () => {
    const {result} = renderHook(() => useEventContextFocus(SectionKey.METRICS));
    act(() => focusEventContextRows(SectionKey.LOGS, ['log-1']));

    act(() => jest.advanceTimersByTime(HIGHLIGHT_DURATION_MS - 1));
    act(() => focusEventContextRows(SectionKey.METRICS, ['metric-1']));
    act(() => jest.advanceTimersByTime(1));

    expect(result.current.ids).toEqual(['metric-1']);
  });
});
