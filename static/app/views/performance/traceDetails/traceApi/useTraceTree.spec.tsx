import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import type {TraceTree} from 'sentry/views/performance/traceDetails/traceModels/traceTree';
import {
  makeEAPSpan,
  makeEAPTrace,
} from 'sentry/views/performance/traceDetails/traceModels/traceTreeTestUtils';
import {DEFAULT_TRACE_VIEW_PREFERENCES} from 'sentry/views/performance/traceDetails/traceState/tracePreferences';
import {TraceStateProvider} from 'sentry/views/performance/traceDetails/traceState/traceStateProvider';

import {useTraceTree} from './useTraceTree';

const getMockedTraceResults = (status: string, data?: TraceTree.EAPTrace) =>
  ({status, data}) as UseApiQueryResult<TraceTree.EAPTrace | undefined, any>;

const contextWrapper = () => {
  return function ({children}: {children: React.ReactNode}) {
    return (
      <TraceStateProvider initialPreferences={DEFAULT_TRACE_VIEW_PREFERENCES}>
        {children}
      </TraceStateProvider>
    );
  };
};

describe('useTraceTree', () => {
  it('returns tree for error case', async () => {
    const {result} = renderHookWithProviders(
      () =>
        useTraceTree({
          trace: getMockedTraceResults('error'),
          replay: null,
        }),
      {additionalWrapper: contextWrapper()}
    );

    await waitFor(() => {
      expect(result.current.type).toBe('error');
    });
  });

  it('returns tree for loading case', async () => {
    const {result} = renderHookWithProviders(
      () =>
        useTraceTree({
          trace: getMockedTraceResults('pending'),
          replay: null,
        }),
      {additionalWrapper: contextWrapper()}
    );

    await waitFor(() => {
      expect(result.current.type).toBe('loading');
    });
  });

  it('returns tree for empty success case', async () => {
    const {result} = renderHookWithProviders(
      () =>
        useTraceTree({
          trace: getMockedTraceResults('success', []),
          replay: null,
        }),
      {additionalWrapper: contextWrapper()}
    );

    await waitFor(() => {
      expect(result.current.type).toBe('empty');
    });
  });

  it('returns tree for non-empty success case', async () => {
    const mockedTrace = makeEAPTrace([
      makeEAPSpan({
        event_id: 'span-1',
        is_transaction: true,
        children: [
          makeEAPSpan({event_id: 'span-2', is_transaction: false, children: []}),
          makeEAPSpan({event_id: 'span-3', is_transaction: false, children: []}),
        ],
      }),
    ]);

    const {result} = renderHookWithProviders(
      () =>
        useTraceTree({
          trace: getMockedTraceResults('success', mockedTrace),
          replay: null,
        }),
      {additionalWrapper: contextWrapper()}
    );

    await waitFor(() => {
      expect(result.current.type).toBe('trace');
    });
    expect(result.current.list.length).toBeGreaterThan(0);
  });
});
