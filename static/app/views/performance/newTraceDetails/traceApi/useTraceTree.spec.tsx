import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {
  makeTraceError,
  makeTransaction,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeTestUtils';
import {DEFAULT_TRACE_VIEW_PREFERENCES} from 'sentry/views/performance/newTraceDetails/traceState/tracePreferences';
import {TraceStateProvider} from 'sentry/views/performance/newTraceDetails/traceState/traceStateProvider';

import type {TraceSplitResults} from './types';
import {useTraceTree} from './useTraceTree';

const getMockedTraceResults = (
  status: string,
  data: TraceSplitResults<TraceTree.Transaction> | undefined = undefined
) =>
  ({
    status,
    data,
  }) as UseApiQueryResult<TraceSplitResults<TraceTree.Transaction> | undefined, any>;

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
    const {result} = renderHookWithProviders(useTraceTree, {
      additionalWrapper: contextWrapper(),
      initialProps: {
        trace: getMockedTraceResults('error'),
        traceSlug: 'test-trace',
        replay: null,
      },
    });

    await waitFor(() => {
      expect(result.current.type).toBe('error');
    });
  });

  it('returns tree for loading case', async () => {
    const {result} = renderHookWithProviders(useTraceTree, {
      additionalWrapper: contextWrapper(),
      initialProps: {
        trace: getMockedTraceResults('pending'),
        traceSlug: 'test-trace',
        replay: null,
      },
    });

    await waitFor(() => {
      expect(result.current.type).toBe('loading');
    });
  });

  it('returns tree for empty success case', async () => {
    const {result} = renderHookWithProviders(useTraceTree, {
      additionalWrapper: contextWrapper(),
      initialProps: {
        trace: getMockedTraceResults('success', {
          transactions: [],
          orphan_errors: [],
        }),
        traceSlug: 'test-trace',
        replay: null,
      },
    });

    await waitFor(() => {
      expect(result.current.type).toBe('empty');
    });
  });

  it('returns tree for non-empty success case', async () => {
    const mockedTrace = {
      transactions: [
        makeTransaction({
          start_timestamp: 0,
          timestamp: 1,
          transaction: 'transaction1',
        }),
        makeTransaction({
          start_timestamp: 1,
          timestamp: 2,
          transaction: 'transaction2',
        }),
        makeTransaction({
          start_timestamp: 0,
          timestamp: 1,
          transaction: 'transaction1',
        }),
        makeTransaction({
          start_timestamp: 1,
          timestamp: 2,
          transaction: 'transaction2',
        }),
      ],
      orphan_errors: [
        makeTraceError({
          title: 'error1',
          level: 'error',
        }),
        makeTraceError({
          title: 'error2',
          level: 'error',
        }),
      ],
    };

    const {result} = renderHookWithProviders(useTraceTree, {
      additionalWrapper: contextWrapper(),
      initialProps: {
        trace: getMockedTraceResults('success', mockedTrace),
        traceSlug: 'test-trace',
        replay: null,
      },
    });

    await waitFor(() => {
      expect(result.current.type).toBe('trace');
    });
    expect(result.current.list).toHaveLength(7);
  });
});
