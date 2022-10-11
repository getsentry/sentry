import {RawSpanType} from 'sentry/components/events/interfaces/spans/types';
import {EntryType, EventOrGroupType, EventTransaction} from 'sentry/types';

import {PerformanceDetectorData} from './../../../../static/app/types/event';

export enum ProblemSpan {
  PARENT = 'parent',
  OFFENDER = 'offender',
}

type AddSpanOpts = {
  endTimestamp: number;
  startTimestamp: number;
  childOpts?: AddSpanOpts[];
  description?: string;
  numSpans?: number;
  op?: string;
  parentSpanId?: string;
  problemSpan?: ProblemSpan;
  status?: string;
};

export class TransactionEventBuilder {
  TRACE_ID = '8cbbc19c0f54447ab702f00263262726';
  ROOT_SPAN_ID = '0000000000000000';
  _event: EventTransaction;
  _spans: RawSpanType[] = [];
  _perfDetectorData: PerformanceDetectorData = {
    causeSpanIds: [],
    offenderSpanIds: [],
    parentSpanIds: [],
  };

  constructor() {
    this._event = {
      id: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      eventID: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      title: '/api/0/transaction-test-endpoint/',
      type: EventOrGroupType.TRANSACTION,
      startTimestamp: 0,
      endTimestamp: 0,
      contexts: {
        trace: {
          trace_id: this.TRACE_ID,
          span_id: this.ROOT_SPAN_ID,
          op: 'pageload',
          status: 'ok',
          type: 'trace',
        },
      },
      entries: [
        {
          data: this._spans,
          type: EntryType.SPANS,
        },
      ],
      perfProblem: {
        causeSpanIds: [],
        offenderSpanIds: [],
        parentSpanIds: [],
      },
      // For the purpose of mock data, we don't care as much about the properties below.
      // They're here to satisfy the type constraints, but in the future if we need actual values here
      // for testing purposes, we can add methods on the builder to set them.
      crashFile: null,
      culprit: '',
      dateReceived: '',
      dist: null,
      errors: [],
      fingerprints: [],
      location: null,
      message: '',
      metadata: {
        current_level: undefined,
        current_tree_label: undefined,
        directive: undefined,
        display_title_with_tree_label: undefined,
        filename: undefined,
        finest_tree_label: undefined,
        function: undefined,
        message: undefined,
        origin: undefined,
        stripped_crash: undefined,
        title: undefined,
        type: undefined,
        uri: undefined,
        value: undefined,
      },
      projectID: '',
      size: 0,
      tags: [],
      user: null,
    };
  }

  /**
   *
   * @param opts.startTimestamp
   * @param opts.endTimestamp
   * @param opts.op The operation of the span
   * @param opts.description The description of the span
   * @param opts.status Optional span specific status, defaults to 'ok'
   * @param opts.numSpans If provided, will create the same span numSpan times
   * @param opts.problemSpan If this span should be part of a performance problem, indicates the type of problem span (i.e ProblemSpan.OFFENDER, ProblemSpan.PARENT)
   * @param opts.parentSpanId When provided, will explicitly set this span's parent ID. If you are creating nested spans via `childOpts`, this will be handled automatically and you do not need to provide an ID.
   * Defaults to the root span's ID.
   * @param opts.childOpts An array containing options for direct children of the current span. Will create direct child spans for each set of options provided
   */
  addSpan(opts: AddSpanOpts) {
    const {
      startTimestamp,
      endTimestamp,
      op,
      description,
      status,
      problemSpan,
      parentSpanId,
      childOpts,
    } = opts;

    if (!opts.numSpans) {
      opts.numSpans = 1;
    }

    for (let i = 0; i < opts.numSpans; i++) {
      // Convert the num of spans to a hex string to get its ID
      const spanId = (this._spans.length + 1).toString(16).padStart(16, '0');

      const span: RawSpanType = {
        op,
        description,
        start_timestamp: startTimestamp,
        timestamp: endTimestamp,
        status: status ?? 'ok',
        data: {},
        span_id: spanId,
        trace_id: this.TRACE_ID,
        parent_span_id: parentSpanId ?? this.ROOT_SPAN_ID,
      };

      this._event.entries[0].data.push(span);

      switch (problemSpan) {
        case ProblemSpan.PARENT:
          this._event.perfProblem?.parentSpanIds.push(spanId);
          break;
        case ProblemSpan.OFFENDER:
          this._event.perfProblem?.offenderSpanIds.push(spanId);
          break;
        default:
          break;
      }

      if (endTimestamp > this._event.endTimestamp) {
        this._event.endTimestamp = endTimestamp;
      }

      if (childOpts) {
        childOpts.forEach(o => this.addSpan({...o, parentSpanId: spanId}));
      }
    }
  }

  getEvent() {
    return this._event;
  }
}
