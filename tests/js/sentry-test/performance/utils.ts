import {RawSpanType} from 'sentry/components/events/interfaces/spans/types';
import {EntryType, EventOrGroupType, EventTransaction} from 'sentry/types';

export enum ProblemSpan {
  PARENT = 'parent',
  OFFENDER = 'offender',
}

export const EXAMPLE_TRANSACTION_TITLE = '/api/0/transaction-test-endpoint/';

type AddSpanOpts = {
  endTimestamp: number;
  startTimestamp: number;
  childOpts?: AddSpanOpts[];
  description?: string;
  op?: string;
  problemSpan?: ProblemSpan;
  status?: string;
};

export class TransactionEventBuilder {
  TRACE_ID = '8cbbc19c0f54447ab702f00263262726';
  ROOT_SPAN_ID = '0000000000000000';
  #event: EventTransaction;
  #spans: RawSpanType[] = [];

  constructor(id?: string, title?: string) {
    this.#event = {
      id: id ?? 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      eventID: id ?? 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      title: title ?? EXAMPLE_TRANSACTION_TITLE,
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
          data: this.#spans,
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

  addSpan(mSpan: MockSpan, parentSpanId?: string) {
    // Convert the num of spans to a hex string to get its ID
    const spanId = (this.#spans.length + 1).toString(16).padStart(16, '0');
    const {span} = mSpan;
    span.span_id = spanId;
    span.trace_id = this.TRACE_ID;
    span.parent_span_id = parentSpanId ?? this.ROOT_SPAN_ID;

    this.#event.entries[0].data.push(span);

    switch (mSpan.problemSpan) {
      case ProblemSpan.PARENT:
        this.#event.perfProblem?.parentSpanIds.push(spanId);
        break;
      case ProblemSpan.OFFENDER:
        this.#event.perfProblem?.offenderSpanIds.push(spanId);
        break;
      default:
        break;
    }

    if (span.timestamp > this.#event.endTimestamp) {
      this.#event.endTimestamp = span.timestamp;
    }

    mSpan.children.forEach(child => this.addSpan(child, spanId));

    return this;
  }

  getEvent() {
    return this.#event;
  }
}

/**
 * A MockSpan object to be used for testing. This object is intended to be used in tandem with `TransactionEventBuilder`
 */
export class MockSpan {
  span: RawSpanType;
  children: MockSpan[] = [];
  problemSpan: ProblemSpan | undefined;

  /**
   *
   * @param opts.startTimestamp
   * @param opts.endTimestamp
   * @param opts.op The operation of the span
   * @param opts.description The description of the span
   * @param opts.status Optional span specific status, defaults to 'ok'
   * @param opts.problemSpan If this span should be part of a performance problem, indicates the type of problem span (i.e ProblemSpan.OFFENDER, ProblemSpan.PARENT)
   * @param opts.parentSpanId When provided, will explicitly set this span's parent ID. If you are creating nested spans via `childOpts`, this will be handled automatically and you do not need to provide an ID.
   * Defaults to the root span's ID.
   * @param opts.childOpts An array containing options for direct children of the current span. Will create direct child spans for each set of options provided
   */
  constructor(opts: AddSpanOpts) {
    const {startTimestamp, endTimestamp, op, description, status, problemSpan} = opts;

    this.span = {
      start_timestamp: startTimestamp,
      timestamp: endTimestamp,
      op,
      description,
      status: status ?? 'ok',
      data: {},
      // These values are automatically assigned by the TransactionEventBuilder when the spans are added
      span_id: '',
      trace_id: '',
      parent_span_id: '',
    };

    this.problemSpan = problemSpan;
  }

  /**
   *
   * @param opts.numSpans If provided, will create the same span numSpan times
   */
  addChild(opts: AddSpanOpts, numSpans = 1) {
    const {startTimestamp, endTimestamp, op, description, status, problemSpan} = opts;

    for (let i = 0; i < numSpans; i++) {
      const span = new MockSpan({
        startTimestamp,
        endTimestamp,
        op,
        description,
        status,
        problemSpan,
      });
      this.children.push(span);
    }

    return this;
  }
}
