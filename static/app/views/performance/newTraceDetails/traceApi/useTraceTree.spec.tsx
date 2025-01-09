import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import type {
  TraceMeta,
  TraceSplitResults,
} from 'sentry/utils/performance/quickTrace/types';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import * as useApi from 'sentry/utils/useApi';
import * as useOrganization from 'sentry/utils/useOrganization';

import type {TraceTree} from '../traceModels/traceTree';
import {makeTraceError, makeTransaction} from '../traceModels/traceTreeTestUtils';

import type {TraceMetaQueryResults} from './useTraceMeta';
import {useTraceTree} from './useTraceTree';

const getMockedTraceResults = (
  status: string,
  data: TraceSplitResults<TraceTree.Transaction> | undefined = undefined
) =>
  ({
    status,
    data,
  }) as UseApiQueryResult<TraceSplitResults<TraceTree.Transaction> | undefined, any>;

const getMockedMetaResults = (status: string, data: TraceMeta | undefined = undefined) =>
  ({
    status,
    data,
  }) as TraceMetaQueryResults;

const organization = OrganizationFixture();

describe('useTraceTree', () => {
  beforeEach(function () {
    jest.restoreAllMocks();
    const api = new MockApiClient();
    jest.spyOn(useApi, 'default').mockReturnValue(api);
    jest.spyOn(useOrganization, 'default').mockReturnValue(organization);
  });

  it('returns tree for error case', async () => {
    const {result} = renderHook(() =>
      useTraceTree({
        trace: getMockedTraceResults('error'),
        meta: getMockedMetaResults('error'),
        traceSlug: 'test-trace',
        replay: null,
      })
    );

    await waitFor(() => {
      expect(result.current.type).toBe('error');
    });
  });

  it('returns tree for loading case', async () => {
    const {result} = renderHook(() =>
      useTraceTree({
        trace: getMockedTraceResults('pending'),
        meta: getMockedMetaResults('pending'),
        traceSlug: 'test-trace',
        replay: null,
      })
    );

    await waitFor(() => {
      expect(result.current.type).toBe('loading');
    });
  });

  it('returns tree for empty success case', async () => {
    const {result} = renderHook(() =>
      useTraceTree({
        trace: getMockedTraceResults('success', {
          transactions: [],
          orphan_errors: [],
        }),
        meta: getMockedMetaResults('success', {
          errors: 1,
          performance_issues: 2,
          projects: 1,
          transactions: 1,
          transactiontoSpanChildrenCount: {
            '1': 1,
          },
        }),
        traceSlug: 'test-trace',
        replay: null,
      })
    );

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

    const mockedMeta = {
      errors: 1,
      performance_issues: 2,
      projects: 1,
      transactions: 1,
      transactiontoSpanChildrenCount: {
        '1': 1,
      },
    };

    const {result} = renderHook(() =>
      useTraceTree({
        trace: getMockedTraceResults('success', mockedTrace),
        meta: getMockedMetaResults('success', mockedMeta),
        traceSlug: 'test-trace',
        replay: null,
      })
    );

    await waitFor(() => {
      expect(result.current.type).toBe('trace');
    });
    expect(result.current.list).toHaveLength(7);
  });
});
