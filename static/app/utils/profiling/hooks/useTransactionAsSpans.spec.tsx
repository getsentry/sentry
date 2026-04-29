import * as Sentry from '@sentry/react';
import moment from 'moment-timezone';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {useTransactionAsSpans} from 'sentry/utils/profiling/hooks/useTransactionAsSpans';

const ORG_SLUG = OrganizationFixture().slug;

describe('useTransaction', () => {
  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('does not fetch when transactionEventId is missing', () => {
    const request = MockApiClient.addMockResponse({
      url: `/organizations/${ORG_SLUG}/events/`,
      body: {data: [], meta: {fields: {}}},
    });

    const {result} = renderHookWithProviders(() =>
      useTransactionAsSpans({projectIds: [1], enabled: true})
    );

    expect(result.current.isEnabled).toBe(false);
    expect(request).not.toHaveBeenCalled();
  });

  it('does not fetch when enabled is false', () => {
    const request = MockApiClient.addMockResponse({
      url: `/organizations/${ORG_SLUG}/events/`,
      body: {data: [], meta: {fields: {}}},
    });

    renderHookWithProviders(() =>
      useTransactionAsSpans({
        projectIds: [1],
        transactionEventId: 'abc',
        enabled: false,
      })
    );

    expect(request).not.toHaveBeenCalled();
  });

  it('splits rows into transactionSpan and childSpans', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${ORG_SLUG}/events/`,
      body: {
        meta: {fields: {}},
        data: [
          {
            span_id: 'txn-span',
            is_transaction: true,
            'span.op': 'transaction',
            'span.description': '/api/test',
          },
          {
            span_id: 'child-1',
            is_transaction: false,
            'span.op': 'db.query',
            'span.description': 'SELECT 1',
          },
          {
            span_id: 'child-2',
            is_transaction: false,
            'span.op': 'http.client',
            'span.description': 'GET /x',
          },
        ],
      },
    });

    const {result} = renderHookWithProviders(() =>
      useTransactionAsSpans({
        projectIds: [1],
        transactionEventId: 'abc',
        start: 1_700_000_000,
        end: 1_700_000_060,
        enabled: true,
      })
    );

    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(result.current.data.transactionSpan?.span_id).toBe('txn-span');
    expect(result.current.data.childSpans).toHaveLength(2);
    expect(result.current.data.childSpans.map(s => s.span_id)).toEqual([
      'child-1',
      'child-2',
    ]);
  });

  it('returns undefined transactionSpan when no row is flagged as transaction', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${ORG_SLUG}/events/`,
      body: {
        meta: {fields: {}},
        data: [{span_id: 'child-only', is_transaction: false}],
      },
    });

    const {result} = renderHookWithProviders(() =>
      useTransactionAsSpans({
        projectIds: [1],
        transactionEventId: 'abc',
        start: 1_700_000_000,
        end: 1_700_000_060,
        enabled: true,
      })
    );

    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(result.current.data.transactionSpan).toBeUndefined();
    expect(result.current.data.childSpans).toHaveLength(1);
  });

  it('filters by transactionEventId and traceId in the query', async () => {
    const request = MockApiClient.addMockResponse({
      url: `/organizations/${ORG_SLUG}/events/`,
      body: {meta: {fields: {}}, data: []},
    });

    renderHookWithProviders(() =>
      useTransactionAsSpans({
        projectIds: [42],
        transactionEventId: 'txn-event-id',
        traceId: 'trace-xyz',
        start: 1_700_000_000,
        end: 1_700_000_060,
        enabled: true,
      })
    );

    await waitFor(() => expect(request).toHaveBeenCalled());

    const call = request.mock.calls[0];
    const query = call![1].query;
    expect(query.query).toContain('transaction.event_id:txn-event-id');
    expect(query.query).toContain('trace:trace-xyz');
    expect(query.field).toEqual(expect.arrayContaining(['span_id', 'is_transaction']));
    expect(query.project).toEqual(['42']);
  });

  it('does not fetch when start or end is missing', () => {
    const request = MockApiClient.addMockResponse({
      url: `/organizations/${ORG_SLUG}/events/`,
      body: {meta: {fields: {}}, data: []},
    });

    renderHookWithProviders(() =>
      useTransactionAsSpans({
        projectIds: [1],
        transactionEventId: 'abc',
        enabled: true,
      })
    );

    expect(request).not.toHaveBeenCalled();
  });

  it('logs an error when the query succeeds but no transaction span is found', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${ORG_SLUG}/events/`,
      body: {
        meta: {fields: {}},
        data: [
          {span_id: 'child-1', is_transaction: false},
          {span_id: 'child-2', is_transaction: false},
        ],
      },
    });

    const errorSpy = jest.spyOn(Sentry.logger, 'error').mockImplementation(() => {});

    const {result} = renderHookWithProviders(() =>
      useTransactionAsSpans({
        projectIds: [42],
        transactionEventId: 'txn-event-id',
        traceId: 'trace-xyz',
        start: 1_700_000_000,
        end: 1_700_000_060,
        enabled: true,
      })
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    await waitFor(() =>
      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to load transaction span for profile',
        {
          transactionId: 'txn-event-id',
          traceId: 'trace-xyz',
          start: 1_700_000_000,
          end: 1_700_000_060,
          projectIds: [42],
          numFoundChildSpans: 2,
        }
      )
    );

    errorSpy.mockRestore();
  });

  it('logs the missing transaction span error exactly once per successful response', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${ORG_SLUG}/events/`,
      body: {
        meta: {fields: {}},
        data: [{span_id: 'child-1', is_transaction: false}],
      },
    });

    const errorSpy = jest.spyOn(Sentry.logger, 'error').mockImplementation(() => {});

    const {result} = renderHookWithProviders(() =>
      useTransactionAsSpans({
        projectIds: [1],
        transactionEventId: 'abc',
        start: 1_700_000_000,
        end: 1_700_000_060,
        enabled: true,
      })
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await waitFor(() => expect(errorSpy).toHaveBeenCalledTimes(1));

    // Give any trailing effects a chance to fire.
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(errorSpy).toHaveBeenCalledTimes(1);

    errorSpy.mockRestore();
  });

  it('does not re-log on incidental re-renders with the same inputs', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${ORG_SLUG}/events/`,
      body: {
        meta: {fields: {}},
        data: [{span_id: 'child-1', is_transaction: false}],
      },
    });

    const errorSpy = jest.spyOn(Sentry.logger, 'error').mockImplementation(() => {});

    const {result, rerender} = renderHookWithProviders(() =>
      useTransactionAsSpans({
        projectIds: [1],
        transactionEventId: 'abc',
        start: 1_700_000_000,
        end: 1_700_000_060,
        enabled: true,
      })
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await waitFor(() => expect(errorSpy).toHaveBeenCalledTimes(1));

    rerender();
    rerender();
    rerender();

    expect(errorSpy).toHaveBeenCalledTimes(1);

    errorSpy.mockRestore();
  });

  it('does not log an error when a transaction span is found', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${ORG_SLUG}/events/`,
      body: {
        meta: {fields: {}},
        data: [
          {span_id: 'txn-span', is_transaction: true},
          {span_id: 'child-1', is_transaction: false},
        ],
      },
    });

    const errorSpy = jest.spyOn(Sentry.logger, 'error').mockImplementation(() => {});

    const {result} = renderHookWithProviders(() =>
      useTransactionAsSpans({
        projectIds: [1],
        transactionEventId: 'abc',
        start: 1_700_000_000,
        end: 1_700_000_060,
        enabled: true,
      })
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(errorSpy).not.toHaveBeenCalled();

    errorSpy.mockRestore();
  });

  it('does not log an error when the query is disabled', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${ORG_SLUG}/events/`,
      body: {meta: {fields: {}}, data: []},
    });

    const errorSpy = jest.spyOn(Sentry.logger, 'error').mockImplementation(() => {});

    renderHookWithProviders(() =>
      useTransactionAsSpans({
        projectIds: [1],
        transactionEventId: 'abc',
        start: 1_700_000_000,
        end: 1_700_000_060,
        enabled: false,
      })
    );

    // Give any pending effects a chance to run before asserting non-invocation.
    await waitFor(() => expect(errorSpy).not.toHaveBeenCalled());

    errorSpy.mockRestore();
  });

  it('pads start/end (in seconds) by one minute when provided', async () => {
    const request = MockApiClient.addMockResponse({
      url: `/organizations/${ORG_SLUG}/events/`,
      body: {meta: {fields: {}}, data: []},
    });

    const startSec = 1_700_000_000;
    const endSec = 1_700_000_060;

    renderHookWithProviders(() =>
      useTransactionAsSpans({
        projectIds: [1],
        transactionEventId: 'abc',
        start: startSec,
        end: endSec,
        enabled: true,
      })
    );

    await waitFor(() => expect(request).toHaveBeenCalled());

    const query = request.mock.calls[0]![1].query;
    expect(query.statsPeriod).toBeFalsy();
    expect(moment.utc(query.start).valueOf()).toBe((startSec - 60) * 1000);
    expect(moment.utc(query.end).valueOf()).toBe((endSec + 60) * 1000);
  });
});
