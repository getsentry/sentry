import type {RawSpanType} from 'sentry/components/events/interfaces/spans/types';
import {parseSearch} from 'sentry/components/searchSyntax/parser';
import {EntryType, type Event} from 'sentry/types';
import {
  type TraceTree,
  TraceTreeNode,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {evaluateTokensForTraceNode} from 'sentry/views/performance/newTraceDetails/traceSearch/traceSearchTokenizer';

const evaluate = evaluateTokensForTraceNode;

const metadata = {
  project_slug: 'project',
  event_id: 'event_id',
};

const s = (input: string) => parseSearch(input) ?? [];

function makeSpan(overrides: Partial<RawSpanType> = {}): TraceTree.Span {
  return {
    op: '',
    description: '',
    span_id: '',
    start_timestamp: 0,
    timestamp: 10,
    event: makeEvent(),
    errors: [],
    performance_issues: [],
    childTransaction: undefined,
    ...overrides,
  } as TraceTree.Span;
}

function makeEvent(overrides: Partial<Event> = {}, spans: RawSpanType[] = []): Event {
  return {
    entries: [{type: EntryType.SPANS, data: spans}],
    ...overrides,
  } as Event;
}

function makeSpanNode(span: Partial<RawSpanType>): TraceTreeNode<TraceTree.Span> {
  return new TraceTreeNode(null, makeSpan(span), metadata);
}

describe('token evaluator', () => {
  it('negates expression', () => {
    const node = makeSpanNode({span_id: '1a3'});
    expect(evaluate(node, s('!span_id:1a3'))).toBe(false);
  });

  describe('string', () => {
    const node = makeSpanNode({span_id: '1a3'});
    function g(v: string) {
      return s(`span_id:${v}`);
    }

    it('exact value', () => {
      expect(evaluate(node, g('1a3'))).toBe(true);
    });
    it('using includes', () => {
      expect(evaluate(node, g('1a'))).toBe(true);
    });
  });

  describe('number', () => {
    const node = makeSpanNode({start_timestamp: 1000});
    function g(v: string) {
      return s(`start_timestamp:${v}`);
    }

    it('exact value', () => {
      expect(evaluate(node, s('start_timestamp:1000'))).toBe(true);
    });
    it('using gt', () => {
      expect(evaluate(node, g('>999'))).toBe(true);
    });
    it('using ge', () => {
      expect(evaluate(node, g('>=1000'))).toBe(true);
    });
    it('using lt', () => {
      expect(evaluate(node, g('<1001'))).toBe(true);
    });
    it('using le', () => {
      expect(evaluate(node, g('<=1000'))).toBe(true);
    });
    it('using eq', () => {
      expect(evaluate(node, g('=1000'))).toBe(true);
    });

    describe('comparing float to int', () => {
      it('query is float, value is int', () => {
        expect(evaluate(makeSpanNode({start_timestamp: 1000}), g('1000.0'))).toBe(true);
      });
      it('query is int, value is float', () => {
        expect(evaluate(makeSpanNode({start_timestamp: 1000.0}), g('1000'))).toBe(true);
      });
    });
  });

  describe('boolean', () => {
    it('true', () => {
      const node = makeSpanNode({same_process_as_parent: true});
      expect(evaluate(node, s('same_process_as_parent:true'))).toBe(true);
    });
    it('false', () => {
      const node = makeSpanNode({same_process_as_parent: false});
      expect(evaluate(node, s('same_process_as_parent:false'))).toBe(true);
    });
  });
  it('null', () => {
    // @ts-expect-error force null on type
    const node = makeSpanNode({same_process_as_parent: null});
    expect(evaluate(node, s('same_process_as_parent:null'))).toBe(true);
  });
  it('undefined', () => {
    const node = makeSpanNode({same_process_as_parent: undefined});
    expect(evaluate(node, s('same_process_as_parent:undefined'))).toBe(true);
  });
});
