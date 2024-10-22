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
import {
  makeEvent,
  makeSpan,
  makeTraceError,
  makeTransaction,
} from '../traceModels/traceTreeTestUtils';

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
        traceResults: getMockedTraceResults('error'),
        metaResults: getMockedMetaResults('error'),
        traceSlug: 'test-trace',
        replayRecord: null,
      })
    );

    await waitFor(() => {
      expect(result.current.type).toBe('error');
    });
  });

  it('returns tree for loading case', async () => {
    const {result} = renderHook(() =>
      useTraceTree({
        traceResults: getMockedTraceResults('pending'),
        metaResults: getMockedMetaResults('pending'),
        traceSlug: 'test-trace',
        replayRecord: null,
      })
    );

    await waitFor(() => {
      expect(result.current.type).toBe('loading');
    });
  });

  it('returns tree for empty success case', async () => {
    const mockedTrace = {
      transactions: [],
      orphan_errors: [],
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
        traceResults: getMockedTraceResults('success', mockedTrace),
        metaResults: getMockedMetaResults('success', mockedMeta),
        traceSlug: 'test-trace',
        replayRecord: null,
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
        traceResults: getMockedTraceResults('success', mockedTrace),
        metaResults: getMockedMetaResults('success', mockedMeta),
        traceSlug: 'test-trace',
        replayRecord: null,
      })
    );

    await waitFor(() => {
      expect(result.current.type).toBe('trace');
      expect(result.current.list).toHaveLength(7);
    });
  });

  it('returns tree for non-empty success auto-zoom case', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/events/project_slug:event_id/?averageColumn=span.self_time&averageColumn=span.duration`,
      method: 'GET',
      body: makeEvent(undefined, [
        makeSpan({span_id: 'other_child_span'}),
        makeSpan({span_id: 'child_span'}),
      ]),
    });

    const mockedTrace = {
      transactions: [
        makeTransaction({
          event_id: 'event_id',
          start_timestamp: 0,
          timestamp: 1,
          transaction: 'transaction1',
          project_slug: 'project_slug',
        }),
      ],
      orphan_errors: [],
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
        traceResults: getMockedTraceResults('success', mockedTrace),
        metaResults: getMockedMetaResults('success', mockedMeta),
        traceSlug: 'test-trace',
        replayRecord: null,
      })
    );

    await waitFor(() => {
      expect(result.current.type).toBe('trace');
      expect(result.current.list).toHaveLength(4);
    });
  });
});
