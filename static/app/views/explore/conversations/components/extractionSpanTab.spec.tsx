import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ExtractionTab} from 'sentry/views/explore/conversations/components/extractionSpanTab';
import {
  parseExtractionInput,
  parseExtractionOutput,
  type Extraction,
} from 'sentry/views/insights/pages/agents/utils/extraction';

const RAW_INPUT = JSON.stringify([
  {
    state:
      'Invoice INV-2291, issued 2026-09-02, net 30. Contacts: Dana Ruiz, Priya Shah.',
    fields: {
      invoice_number: {type: 'text', instructions: 'The invoice ID'},
      due_date: {type: 'date'},
      contacts: {type: 'list'},
      po_number: {type: 'text'},
    },
  },
]);

const RAW_OUTPUT = JSON.stringify([
  {
    answers: {
      invoice_number: {type: 'text', span: [8, 16], confidence: 0.99, value: 'INV-2291'},
      due_date: {type: 'date', guess: 'net 30', value: '2026-10-02'},
      contacts: {
        type: 'list',
        spans: [
          [55, 64],
          [66, 76],
        ],
        value: ['Dana Ruiz', 'Priya Shah'],
      },
      po_number: {
        type: 'text',
        p_null: 0.97,
        span: [0, 7],
        guess: 'Invoice',
        value: null,
      },
    },
  },
]);

function makeExtraction(overrides: Partial<Extraction> = {}): Extraction {
  return {
    input: parseExtractionInput(RAW_INPUT),
    answers: parseExtractionOutput(RAW_OUTPUT),
    rawInput: RAW_INPUT,
    rawOutput: RAW_OUTPUT,
    ...overrides,
  };
}

function getMark(text: string) {
  return screen.getAllByText(text).find(element => element.tagName === 'MARK');
}

describe('ExtractionTab', () => {
  it('renders the source above each field with its value', () => {
    render(<ExtractionTab extraction={makeExtraction()} />);

    const source = screen.getByText('Source');
    const results = screen.getByText('Results');
    expect(source.compareDocumentPosition(results)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );

    expect(screen.getByText('The invoice ID')).toBeInTheDocument();
    expect(screen.getByText('99%')).toBeInTheDocument();
    expect(getMark('INV-2291')).toBeDefined();

    expect(screen.getByText('2026-10-02')).toBeInTheDocument();
    expect(screen.getByText('Inferred')).toBeInTheDocument();
    expect(screen.getByText('net 30', {selector: 'span'})).toBeInTheDocument();

    expect(getMark('Dana Ruiz')).toBeDefined();
    expect(getMark('Priya Shah')).toBeDefined();
  });

  it('marks fields that were not found without a highlight', async () => {
    render(<ExtractionTab extraction={makeExtraction()} />);

    expect(screen.getByText('po_number')).toBeInTheDocument();
    expect(screen.queryByText('97%')).not.toBeInTheDocument();
    await userEvent.hover(screen.getByText('Not in source'));
    expect(
      await screen.findByText(
        "97% confidence reported by the model that the source doesn't contain this field"
      )
    ).toBeInTheDocument();
    expect(screen.getByText(/Rejected candidate/)).toBeInTheDocument();
    expect(getMark('Invoice')).toBeUndefined();
  });

  it('links hovered fields and source values', async () => {
    render(<ExtractionTab extraction={makeExtraction()} />);

    const value = getMark('INV-2291')!;
    const instructions = screen.getByText('The invoice ID');
    expect(value).not.toHaveAttribute('data-active');

    await userEvent.hover(instructions);
    expect(value).toHaveAttribute('data-active');

    await userEvent.unhover(instructions);
    expect(value).not.toHaveAttribute('data-active');

    expect(instructions.closest('[data-active]')).toBeNull();
    await userEvent.hover(value);
    expect(instructions.closest('[data-active]')).not.toBeNull();
  });

  it('does not emphasize fields without a location in the source', async () => {
    render(<ExtractionTab extraction={makeExtraction()} />);

    const notFound = screen.getByText('po_number');
    await userEvent.hover(notFound);
    expect(notFound.closest('[data-active]')).toBeNull();

    const inferred = screen.getByText('due_date');
    await userEvent.hover(inferred);
    expect(inferred.closest('[data-active]')).toBeNull();
  });

  it('shows malformed fields and answers as recorded', () => {
    const rawInput = JSON.stringify([
      {state: 'Invoice INV-2291', fields: {total: {type: 3}}},
    ]);
    const rawOutput = JSON.stringify([
      {answers: {total: {type: 'number', value: 1080, confidence: 'unsureRawValue'}}},
    ]);
    render(
      <ExtractionTab
        extraction={{
          input: parseExtractionInput(rawInput),
          answers: parseExtractionOutput(rawOutput),
          rawInput,
          rawOutput,
        }}
      />
    );

    expect(screen.getByText('total')).toBeInTheDocument();
    expect(screen.getAllByText('Unrecognized')).toHaveLength(2);
    expect(screen.getByText(/unsureRawValue/)).toBeInTheDocument();
  });

  it('toggles between the formatted and recorded messages', async () => {
    render(<ExtractionTab extraction={makeExtraction()} />);

    await userEvent.click(screen.getByRole('radio', {name: 'Raw'}));

    expect(screen.getByText('Input')).toBeInTheDocument();
    expect(screen.getByText('Output')).toBeInTheDocument();
    expect(screen.queryByText('Results')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', {name: 'Pretty'}));

    expect(screen.getByText('Results')).toBeInTheDocument();
  });

  it('shows both messages as recorded when one cannot be read', () => {
    render(
      <ExtractionTab
        extraction={makeExtraction({answers: null, rawOutput: '{"error": "timeout"}'})}
      />
    );

    expect(screen.getByText('Input')).toBeInTheDocument();
    expect(screen.getByText('Output')).toBeInTheDocument();
    expect(screen.getByText(/timeout/)).toBeInTheDocument();
    expect(screen.queryByText('Results')).not.toBeInTheDocument();
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
  });

  it('lists the fields as unanswered when there is no output', () => {
    render(
      <ExtractionTab extraction={makeExtraction({answers: null, rawOutput: undefined})} />
    );

    expect(screen.getByText('invoice_number')).toBeInTheDocument();
    expect(screen.getAllByText('No answer')).toHaveLength(4);
  });

  it('shows an empty state without any messages', () => {
    render(
      <ExtractionTab
        extraction={{
          input: null,
          answers: null,
          rawInput: undefined,
          rawOutput: undefined,
        }}
      />
    );

    expect(screen.getByText('No extraction for this span')).toBeInTheDocument();
  });
});
