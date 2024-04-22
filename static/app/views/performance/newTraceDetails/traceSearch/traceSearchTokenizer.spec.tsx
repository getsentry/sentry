import type {RawSpanType} from 'sentry/components/events/interfaces/spans/types';
import {EntryType, type Event} from 'sentry/types';
import {
  type TraceTree,
  TraceTreeNode,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {evaluateTokenForTraceNode} from 'sentry/views/performance/newTraceDetails/traceSearch/traceSearchTokenizer';

import grammar from './traceSearch.pegjs';

const evaluate = evaluateTokenForTraceNode;

const metadata = {
  project_slug: 'project',
  event_id: 'event_id',
};

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
    childTransactions: [],
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

describe('traceSearchTokenizer', () => {
  it('empty value', () => {
    expect(grammar.parse('')).toEqual([]);
  });

  test.each([
    'key:value',
    'key :value',
    'key : value',
    '  key:  value',
    'key:  value   ',
  ])('parses %s', input => {
    expect(grammar.parse(input)).toEqual([{type: 'Token', key: 'key', value: 'value'}]);
  });

  describe('grammar', () => {
    it('alphanumeric', () => {
      expect(grammar.parse('key:1a_-.!$')[0].value).toBe('1a_-.!$');
    });

    it('integer', () => {
      // @TODO scientific notation?
      // @TODO should we evaluate arithmetic expressions?
      // Support unit suffies (B, KB, MB, GB), (ms, s, m, h, d, w, y)
      expect(grammar.parse('key:1')[0].value).toBe(1);
      expect(grammar.parse('key:10')[0].value).toBe(10);
      expect(grammar.parse('key:-10')[0].value).toBe(-10);
    });

    it('float', () => {
      expect(grammar.parse('key:.5')[0].value).toBe(0.5);
      expect(grammar.parse('key:-.5')[0].value).toBe(-0.5);
      expect(grammar.parse('key:1.000')[0].value).toBe(1.0);
      expect(grammar.parse('key:1.5')[0].value).toBe(1.5);
      expect(grammar.parse('key:-1.0')[0].value).toBe(-1.0);
    });

    it('boolean', () => {
      expect(grammar.parse('key:true')[0].value).toBe(true);
      expect(grammar.parse('key:false')[0].value).toBe(false);
    });

    it('undefined', () => {
      expect(grammar.parse('key:undefined')[0].value).toBe(undefined);
    });

    it('null', () => {
      expect(grammar.parse('key:null')[0].value).toBe(null);
    });

    it('multiple expressions', () => {
      expect(grammar.parse('key1:value key2:value')).toEqual([
        {type: 'Token', key: 'key1', value: 'value'},
        {type: 'Token', key: 'key2', value: 'value'},
      ]);
    });

    it('value operator', () => {
      expect(grammar.parse('key:>value')[0].operator).toBe('gt');
      expect(grammar.parse('key:>=value')[0].operator).toBe('ge');
      expect(grammar.parse('key:<value')[0].operator).toBe('lt');
      expect(grammar.parse('key:<=value')[0].operator).toBe('le');
      expect(grammar.parse('key:=value')[0].operator).toBe('eq');
    });

    it('negation', () => {
      expect(grammar.parse('!key:value')[0].negated).toBe(true);
    });
  });

  describe('transaction properties', () => {});
  describe('autogrouped properties', () => {});
  describe('missing instrumentation properties', () => {});
  describe('error properties', () => {});
  describe('perf issue', () => {});

  describe('tag properties', () => {});
  describe('measurement properties', () => {});
  describe('vitals properties', () => {});
});

describe('lexer', () => {
  // it.todo('checks for empty key');
  // it.todo('checks for invalid key');
  // it.todo('checks for unknown keys');
  // it.todo('checks for invalid operator');
  // it.todo('checks for invalid value');
  // it.todo("supports OR'ing expressions");
  // it.todo("supports AND'ing expressions");
  // it.todo('supports operator precedence via ()');
});

describe('token evaluator', () => {
  it('negates expression', () => {
    const node = makeSpanNode({span_id: '1a3'});
    expect(evaluate(node, grammar.parse('!span_id:1a3')[0])).toBe(false);
  });

  describe('string', () => {
    const node = makeSpanNode({span_id: '1a3'});
    function g(v: string) {
      return grammar.parse(`span_id:${v}`)[0];
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
      return grammar.parse(`start_timestamp:${v}`)[0];
    }

    it('exact value', () => {
      expect(evaluate(node, grammar.parse('start_timestamp:1000')[0])).toBe(true);
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
      expect(evaluate(node, grammar.parse('same_process_as_parent:true')[0])).toBe(true);
    });
    it('false', () => {
      const node = makeSpanNode({same_process_as_parent: false});
      expect(evaluate(node, grammar.parse('same_process_as_parent:false')[0])).toBe(true);
    });
  });
  it('null', () => {
    // @ts-expect-error force null on type
    const node = makeSpanNode({same_process_as_parent: null});
    expect(evaluate(node, grammar.parse('same_process_as_parent:null')[0])).toBe(true);
  });
  it('undefined', () => {
    const node = makeSpanNode({same_process_as_parent: undefined});
    expect(evaluate(node, grammar.parse('same_process_as_parent:undefined')[0])).toBe(
      true
    );
  });
});
