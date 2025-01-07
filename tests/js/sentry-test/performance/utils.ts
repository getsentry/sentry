import type {RawSpanType} from 'sentry/components/events/interfaces/spans/types';
import type {EventTransaction} from 'sentry/types/event';
import {EntryType, EventOrGroupType} from 'sentry/types/event';
import {IssueType} from 'sentry/types/group';

export enum ProblemSpan {
  PARENT = 'parent',
  OFFENDER = 'offender',
  CAUSE = 'cause',
}

export const EXAMPLE_TRANSACTION_TITLE = '/api/0/transaction-test-endpoint/';

type AddSpanOpts = {
  endTimestamp: number;
  startTimestamp: number;
  data?: Record<string, any>;
  description?: string;
  hash?: string;
  op?: string;
  problemSpan?: ProblemSpan | ProblemSpan[];
  status?: string;
};

interface TransactionSettings {
  duration?: number;
  fcp?: number;
}
export class TransactionEventBuilder {
  TRACE_ID = '8cbbc19c0f54447ab702f00263262726';
  ROOT_SPAN_ID = '0000000000000000';
  #event: EventTransaction;
  #spans: RawSpanType[] = [];

  constructor(
    id?: string,
    title?: string,
    problemType?: IssueType,
    transactionSettings?: TransactionSettings,
    occurenceBasedEvent?: boolean
  ) {
    const perfEvidenceData = {
      causeSpanIds: [],
      offenderSpanIds: [],
      parentSpanIds: [],
    };
    this.#event = {
      id: id ?? 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      eventID: id ?? 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      title: title ?? EXAMPLE_TRANSACTION_TITLE,
      type: EventOrGroupType.TRANSACTION,
      startTimestamp: 0,
      endTimestamp: transactionSettings?.duration ?? 0,
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
      measurements: {
        fcp: {
          value: transactionSettings?.fcp ?? 0,
          unit: 'millisecond',
        },
      },
      perfProblem: undefined,
      metadata: {
        current_level: undefined,
        filename: undefined,
        function: undefined,
        message: undefined,
        origin: undefined,
        stripped_crash: undefined,
        title: undefined,
        type: undefined,
        uri: undefined,
        value: undefined,
      },
      occurrence: null,
      projectID: '',
      size: 0,
      tags: [],
      user: null,
    };
    if (occurenceBasedEvent) {
      this.#event.occurrence = {
        evidenceData: perfEvidenceData,
        eventId: id ?? 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        detectionTime: '100',
        evidenceDisplay: [],
        fingerprint: ['fingerprint123'],
        id: 'id123',
        issueTitle: 'N + 1 Query',
        resourceId: '',
        subtitle: 'SELECT * FROM TABLE',
        type: 1006,
      };
    } else {
      this.#event.perfProblem = perfEvidenceData;
      this.#event.perfProblem.issueType =
        problemType ?? IssueType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES;
    }
  }

  generateSpanId() {
    // Convert the num of spans to a hex string to get its ID
    return (this.#spans.length + 1).toString(16).padStart(16, '0');
  }

  addEntry(entry: EventTransaction['entries'][number]) {
    this.#event.entries.push(entry);
  }

  addSpan(mockSpan: MockSpan, numSpans = 1, parentSpanId?: string) {
    for (let i = 0; i < numSpans; i++) {
      const spanId = this.generateSpanId();
      const {span} = mockSpan;
      const clonedSpan = {...span};

      clonedSpan.span_id = spanId;
      clonedSpan.trace_id = this.TRACE_ID;
      clonedSpan.parent_span_id = parentSpanId ?? this.ROOT_SPAN_ID;

      this.#spans.push(clonedSpan);

      const problemSpans = Array.isArray(mockSpan.problemSpan)
        ? mockSpan.problemSpan
        : [mockSpan.problemSpan];

      const perfEvidenceData =
        this.#event.perfProblem ?? this.#event.occurrence?.evidenceData;

      problemSpans.forEach(problemSpan => {
        switch (problemSpan) {
          case ProblemSpan.PARENT:
            perfEvidenceData?.parentSpanIds.push(spanId);
            break;
          case ProblemSpan.OFFENDER:
            perfEvidenceData?.offenderSpanIds.push(spanId);
            break;
          case ProblemSpan.CAUSE:
            perfEvidenceData?.causeSpanIds.push(spanId);
            break;
          default:
            break;
        }
      });

      if (clonedSpan.timestamp > this.#event.endTimestamp) {
        this.#event.endTimestamp = clonedSpan.timestamp;
      }

      mockSpan.children.forEach(child => this.addSpan(child, 1, spanId));
    }

    return this;
  }

  getEventFixture() {
    return this.#event;
  }
}

/**
 * A MockSpan object to be used for testing. This object is intended to be used in tandem with `TransactionEventBuilder`
 */
export class MockSpan {
  span: RawSpanType;
  children: MockSpan[] = [];
  problemSpan: ProblemSpan | ProblemSpan[] | undefined;

  /**
   *
   * @param opts.startTimestamp
   * @param opts.endTimestamp
   * @param opts.op The operation of the span
   * @param opts.description The description of the span
   * @param opts.status Optional span specific status, defaults to 'ok'
   * @param opts.problemSpan If this span should be part of a performance problem, indicates the type of problem span (i.e ProblemSpan.OFFENDER, ProblemSpan.PARENT)
   * @param opts.parentSpanId When provided, will explicitly set this span's parent ID. If you are creating nested spans via `addChild` on the `MockSpan` object,
   * this will be handled automatically and you do not need to provide an ID. Defaults to the root span's ID.
   */
  constructor(opts: AddSpanOpts) {
    const {startTimestamp, endTimestamp, op, description, hash, status, problemSpan} =
      opts;

    this.span = {
      start_timestamp: startTimestamp,
      timestamp: endTimestamp,
      op,
      description,
      hash,
      status: status ?? 'ok',
      data: opts.data || {},
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
    const {startTimestamp, endTimestamp, op, description, hash, status, problemSpan} =
      opts;

    for (let i = 0; i < numSpans; i++) {
      const span = new MockSpan({
        startTimestamp,
        endTimestamp,
        op,
        description,
        hash,
        status,
        problemSpan,
      });
      this.children.push(span);
    }

    return this;
  }

  /**
   * Allows you to create a nested group of duplicate mock spans by duplicating the current span. This is useful for simulating the nested 'autogrouped' condition on the span tree.
   * Will create `depth` spans, each span being a child of the previous.
   * @param depth
   */
  addDuplicateNestedChildren(depth = 1) {
    let currentSpan: MockSpan = this;

    for (let i = 0; i < depth; i++) {
      currentSpan.addChild(currentSpan.getOpts());
      currentSpan = currentSpan.children[0]!;
    }

    return this;
  }

  getOpts() {
    return {
      startTimestamp: this.span.start_timestamp,
      endTimestamp: this.span.timestamp,
      op: this.span.op,
      description: this.span.description,
      status: this.span.status,
      problemSpan: this.problemSpan,
    };
  }
}
