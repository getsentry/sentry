import {
  getExtractedValueLabel,
  getExtractionPreview,
  getExtractionRows,
  getNodeExtraction,
  getSourceSegments,
  isInferredAnswer,
  parseExtractionInput,
  parseExtractionOutput,
} from 'sentry/views/insights/pages/agents/utils/extraction';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';

function makeNode(attributes: Record<string, string>): AITraceSpanNode {
  return {errors: new Set(), attributes} as unknown as AITraceSpanNode;
}

const SOURCE = 'Invoice INV-2291, net 30. Contact: Dana Ruiz, Priya Shah.';

const RAW_INPUT = JSON.stringify([
  {
    state: SOURCE,
    fields: {
      invoice_number: {type: 'text', instructions: 'The invoice ID'},
      contacts: {type: 'list'},
    },
  },
]);

const RAW_OUTPUT = JSON.stringify([
  {
    answers: {
      invoice_number: {
        type: 'text',
        p_null: 0.00001,
        span: [8, 16],
        guess: 'INV-2291',
        confidence: 0.99,
        value: 'INV-2291',
      },
      contacts: {
        type: 'list',
        spans: [
          [35, 44],
          [46, 56],
        ],
        value: ['Dana Ruiz', 'Priya Shah'],
      },
      po_number: {type: 'text', p_null: 0.97, value: null},
    },
  },
]);

describe('parseExtractionInput', () => {
  it('parses the source text and fields', () => {
    expect(parseExtractionInput(RAW_INPUT)).toEqual({
      source: SOURCE,
      fields: [
        {
          key: 'invoice_number',
          kind: 'field',
          type: 'text',
          instructions: 'The invoice ID',
        },
        {key: 'contacts', kind: 'field', type: 'list'},
      ],
    });
  });

  it('keeps malformed fields as invalid', () => {
    const raw = JSON.stringify([{state: SOURCE, fields: {total: {type: 3}}}]);
    expect(parseExtractionInput(raw)?.fields).toEqual([
      {key: 'total', kind: 'invalid', value: {type: 3}},
    ]);
  });

  it('returns null without a source text', () => {
    expect(parseExtractionInput(JSON.stringify([{fields: {}}]))).toBeNull();
    expect(parseExtractionInput('not json')).toBeNull();
    expect(parseExtractionInput(undefined)).toBeNull();
  });
});

describe('parseExtractionOutput', () => {
  it('normalizes single and list offsets', () => {
    const answers = parseExtractionOutput(RAW_OUTPUT);
    expect(answers).toEqual([
      {
        key: 'invoice_number',
        kind: 'answer',
        type: 'text',
        value: 'INV-2291',
        guess: 'INV-2291',
        confidence: 0.99,
        nullProbability: 0.00001,
        offsets: [[8, 16]],
      },
      {
        key: 'contacts',
        kind: 'answer',
        type: 'list',
        value: ['Dana Ruiz', 'Priya Shah'],
        nullProbability: undefined,
        offsets: [
          [35, 44],
          [46, 56],
        ],
      },
      {
        key: 'po_number',
        kind: 'answer',
        type: 'text',
        value: null,
        nullProbability: 0.97,
        offsets: [],
      },
    ]);
  });

  it('returns null when the output has no answers', () => {
    expect(parseExtractionOutput(JSON.stringify([{foo: 'bar'}]))).toBeNull();
  });
});

describe('getNodeExtraction', () => {
  it('reads extraction spans by operation name', () => {
    const extraction = getNodeExtraction(
      makeNode({
        'gen_ai.operation.name': 'extract',
        'gen_ai.input.messages': RAW_INPUT,
        'gen_ai.output.messages': RAW_OUTPUT,
      })
    );
    expect(extraction?.input?.source).toBe(SOURCE);
    expect(extraction?.answers).toHaveLength(3);
    expect(getExtractionPreview(extraction ?? undefined)).toBe(
      'invoice_number: INV-2291, contacts: Dana Ruiz, Priya Shah'
    );
  });

  it('ignores other spans', () => {
    expect(
      getNodeExtraction(
        makeNode({'gen_ai.operation.name': 'chat', 'gen_ai.input.messages': RAW_INPUT})
      )
    ).toBeNull();
  });
});

describe('getExtractedValueLabel', () => {
  it('formats numbers and booleans', () => {
    const [total, paid] = parseExtractionOutput(
      JSON.stringify({
        answers: {
          total: {type: 'number', value: 1080},
          paid: {type: 'bool', value: false},
        },
      })
    )!;
    expect(getExtractedValueLabel(total!)).toBe('1080');
    expect(getExtractedValueLabel(paid!)).toBe('No');
  });

  it('returns null for fields that were not found', () => {
    const [poNumber] = parseExtractionOutput(
      JSON.stringify({answers: {po_number: {type: 'text', value: null}}})
    )!;
    expect(getExtractedValueLabel(poNumber!)).toBeNull();
  });
});

describe('getExtractionRows', () => {
  it('pairs fields with answers, keeping field order', () => {
    const fields = parseExtractionInput(RAW_INPUT)!.fields;
    const answers = parseExtractionOutput(RAW_OUTPUT)!;
    expect(
      getExtractionRows(fields, answers).map(row => [
        row.key,
        row.field?.kind,
        row.answer?.kind,
      ])
    ).toEqual([
      ['invoice_number', 'field', 'answer'],
      ['contacts', 'field', 'answer'],
      // Answered but not requested.
      ['po_number', undefined, 'answer'],
    ]);
  });

  it('lists fields without answers when the output is missing', () => {
    const fields = parseExtractionInput(RAW_INPUT)!.fields;
    expect(getExtractionRows(fields, null).map(row => row.answer)).toEqual([
      undefined,
      undefined,
    ]);
  });
});

describe('isInferredAnswer', () => {
  it('flags found values without a source location', () => {
    const [located, inferred, missing] = parseExtractionOutput(
      JSON.stringify({
        answers: {
          invoice_number: {type: 'text', span: [8, 16], value: 'INV-2291'},
          due_date: {type: 'date', guess: '2026-10-02', value: '2026-10-02'},
          po_number: {type: 'text', value: null},
        },
      })
    )!;
    expect(isInferredAnswer(located)).toBe(false);
    expect(isInferredAnswer(inferred)).toBe(true);
    expect(isInferredAnswer(missing)).toBe(false);
  });
});

describe('getSourceSegments', () => {
  it('splits the source around matched values', () => {
    const segments = getSourceSegments(SOURCE, parseExtractionOutput(RAW_OUTPUT));
    expect(segments).toEqual([
      {text: 'Invoice '},
      {text: 'INV-2291', keys: ['invoice_number']},
      {text: ', net 30. Contact: '},
      {text: 'Dana Ruiz', keys: ['contacts']},
      {text: ', '},
      {text: 'Priya Shah', keys: ['contacts']},
      {text: '.'},
    ]);
    expect(segments.map(segment => segment.text).join('')).toBe(SOURCE);
  });

  it('does not highlight candidates for fields that were not found', () => {
    const answers = parseExtractionOutput(
      JSON.stringify({
        answers: {
          po_number: {type: 'text', span: [8, 16], guess: 'INV-2291', value: null},
        },
      })
    );
    expect(getSourceSegments(SOURCE, answers)).toEqual([{text: SOURCE}]);
  });

  it('merges overlaps and drops out-of-range offsets', () => {
    const answers = parseExtractionOutput(
      JSON.stringify({
        answers: {
          a: {type: 'text', span: [0, 7], value: 'Invoice'},
          b: {type: 'text', span: [4, 16], value: 'ice INV-2291'},
          c: {type: 'text', span: [10, 999], value: 'x'},
        },
      })
    );
    expect(getSourceSegments(SOURCE, answers)).toEqual([
      {text: 'Invoice INV-2291', keys: ['a', 'b']},
      {text: SOURCE.slice(16)},
    ]);
  });
});
