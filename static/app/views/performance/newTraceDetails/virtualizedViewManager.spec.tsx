import type {List} from 'react-virtualized';
import {OrganizationFixture} from 'sentry-fixture/organization';

import type {RawSpanType} from 'sentry/components/events/interfaces/spans/types';
import {EntryType, type Event} from 'sentry/types';
import type {
  TraceFullDetailed,
  TraceSplitResults,
} from 'sentry/utils/performance/quickTrace/types';
import {VirtualizedViewManager} from 'sentry/views/performance/newTraceDetails/virtualizedViewManager';

import {TraceTree} from './traceTree';

function makeEvent(overrides: Partial<Event> = {}, spans: RawSpanType[] = []): Event {
  return {
    entries: [{type: EntryType.SPANS, data: spans}],
    ...overrides,
  } as Event;
}

function makeTrace(
  overrides: Partial<TraceSplitResults<TraceFullDetailed>>
): TraceSplitResults<TraceFullDetailed> {
  return {
    transactions: [],
    orphan_errors: [],
    ...overrides,
  } as TraceSplitResults<TraceFullDetailed>;
}

function makeTransaction(overrides: Partial<TraceFullDetailed> = {}): TraceFullDetailed {
  return {
    children: [],
    start_timestamp: 0,
    timestamp: 1,
    transaction: 'transaction',
    'transaction.op': '',
    'transaction.status': '',
    ...overrides,
  } as TraceFullDetailed;
}

function makeSpan(overrides: Partial<RawSpanType> = {}): RawSpanType {
  return {
    op: '',
    description: '',
    span_id: '',
    start_timestamp: 0,
    timestamp: 10,
    ...overrides,
  } as RawSpanType;
}

describe('VirtualizedViewManger', () => {
  it('scrolls to transaction', async () => {
    const organization = OrganizationFixture();
    const api = new MockApiClient();
    const manager = new VirtualizedViewManager({
      list: {width: 0.5},
      span_list: {width: 0.5},
    });

    const tree = TraceTree.FromTrace(
      makeTrace({
        transactions: [
          makeTransaction(),

          makeTransaction({
            event_id: 'event_id',
            children: [],
          }),
        ],
      })
    );

    const path = tree.root.children[0].children[1].path;
    expect(path).toEqual(['txn:event_id']);

    const list = {
      scrollToRow: jest.fn(),
    } as unknown as List;

    manager.virtualizedList = list;

    await manager.scrollToPath(tree, path, () => void 0, {
      api: api,
      organization,
    });

    expect(list.scrollToRow).toHaveBeenCalledWith(2);
  });

  it('scrolls to spans and expands transaction', async () => {
    const organization = OrganizationFixture();
    const api = new MockApiClient();
    const manager = new VirtualizedViewManager({
      list: {width: 0.5},
      span_list: {width: 0.5},
    });

    const tree = TraceTree.FromTrace(
      makeTrace({
        transactions: [
          makeTransaction(),
          makeTransaction({
            event_id: 'event_id',
            children: [],
          }),
        ],
      })
    );

    const request = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/event_id:undefined/',
      method: 'GET',
      body: makeEvent(undefined, [makeSpan({span_id: 'span_id'})]),
    });

    const list = {
      scrollToRow: jest.fn(),
    } as unknown as List;

    manager.virtualizedList = list;

    await manager.scrollToPath(tree, ['txn:event_id', 'span:span_id'], () => void 0, {
      api: api,
      organization,
    });

    expect(request).toHaveBeenCalled();
    expect(list.scrollToRow).toHaveBeenCalledTimes(2);
  });
});
