import {getTraceKnownData} from 'sentry/components/events/contexts/trace/getTraceKnownData';

import {traceContextMetaMockData, traceMockData} from './index.spec';

describe('getTraceKnownData', function () {
  it('filters data and transforms into the right way', function () {
    const traceKnownData = getTraceKnownData({
      data: traceMockData,
      meta: traceContextMetaMockData,
      organization: TestStubs.Organization(),
      event: TestStubs.Event(),
    });

    expect(traceKnownData).toEqual([
      {
        key: 'status',
        subject: 'Status',
        value: 'unknown',
        meta: undefined,
        subjectDataTestId: 'trace-context-status-value',
      },
      {
        key: 'trace_id',
        subject: 'Trace ID',
        value: '61d2d7c5acf448ffa8e2f8f973e2cd36',
        meta: undefined,
        subjectDataTestId: 'trace-context-trace_id-value',
      },
      {
        key: 'span_id',
        subject: 'Span ID',
        value: 'a5702f287954a9ef',
        meta: undefined,
        subjectDataTestId: 'trace-context-span_id-value',
      },
      {
        key: 'parent_span_id',
        subject: 'Parent Span ID',
        value: 'b23703998ae619e7',
        meta: undefined,
        subjectDataTestId: 'trace-context-parent_span_id-value',
      },
      {
        key: 'op',
        subject: 'Operation Name',
        value: 'something',
        meta: traceContextMetaMockData.op[''],
        subjectDataTestId: 'trace-context-op-value',
      },
    ]);
  });
});
