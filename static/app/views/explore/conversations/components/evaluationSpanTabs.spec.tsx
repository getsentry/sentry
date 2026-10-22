import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {
  EvaluationInputTab,
  EvaluationOutputTab,
  ExtractionTab,
} from 'sentry/views/explore/conversations/components/evaluationSpanTabs';
import {
  parseExtractionInput,
  parseExtractionOutput,
  type Extraction,
} from 'sentry/views/insights/pages/agents/utils/extraction';

const RAW_INPUT = JSON.stringify([{type: 'evaluation', state: 'I cannot log in.'}]);

const RAW_OUTPUT = JSON.stringify([
  {type: 'evaluation', answers: {}, rawOnlyOutputKey: true},
]);

describe('EvaluationInputTab', () => {
  it('renders the evaluated text and questions', () => {
    render(
      <EvaluationInputTab
        raw={RAW_INPUT}
        input={{
          state: [{parts: [{kind: 'text', text: 'I cannot log in.'}]}],
          questions: [{key: 'authIssue', kind: 'question', type: 'boolean'}],
        }}
      />
    );

    expect(screen.getByText('Evaluated Content')).toBeInTheDocument();
    expect(screen.getByText('I cannot log in.')).toBeInTheDocument();
    expect(screen.getByText('Questions')).toBeInTheDocument();
    expect(screen.getByText('authIssue')).toBeInTheDocument();
  });

  it('shows questions that are not a map raw', () => {
    render(
      <EvaluationInputTab
        raw={RAW_INPUT}
        input={{
          state: [{parts: [{kind: 'text', text: 'I cannot log in.'}]}],
          questions: [],
          invalidQuestions: {value: ['authIssueRawValue']},
        }}
      />
    );

    expect(screen.getByText('I cannot log in.')).toBeInTheDocument();
    expect(screen.getByText('Questions')).toBeInTheDocument();
    expect(screen.getByText('Unrecognized')).toBeInTheDocument();
    expect(screen.getByText(/authIssueRawValue/)).toBeInTheDocument();
  });

  it('shows an unreadable message raw, without a toggle', () => {
    render(<EvaluationInputTab raw="not json at all" input={null} />);

    expect(screen.getByText('Raw Message')).toBeInTheDocument();
    expect(screen.getByText('not json at all')).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
  });
});

describe('EvaluationOutputTab', () => {
  it('toggles between the answers and the raw message', async () => {
    render(
      <EvaluationOutputTab
        raw={RAW_OUTPUT}
        answers={[{kind: 'boolean', key: 'authIssue', probability: 0.97}]}
      />
    );

    expect(screen.getByText('Answers')).toBeInTheDocument();
    expect(screen.getByText('authIssue')).toBeInTheDocument();
    expect(screen.queryByText(/rawOnlyOutputKey/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', {name: 'Raw'}));

    expect(screen.getByText(/rawOnlyOutputKey/)).toBeInTheDocument();
    expect(screen.queryByText('authIssue')).not.toBeInTheDocument();

    // The raw box shows plain JSON text without its own Pretty/Raw toggle.
    await userEvent.hover(screen.getByText(/rawOnlyOutputKey/));
    expect(screen.getAllByRole('radiogroup')).toHaveLength(1);

    await userEvent.click(screen.getByRole('radio', {name: 'Pretty'}));

    expect(screen.getByText('authIssue')).toBeInTheDocument();
  });
});

const RAW_EXTRACTION_INPUT = JSON.stringify([
  {
    state: 'Invoice INV-2291, issued 2026-09-02, net 30.',
    fields: {
      invoice_number: {type: 'text', instructions: 'The invoice ID'},
      due_date: {type: 'date'},
    },
  },
]);

const RAW_EXTRACTION_OUTPUT = JSON.stringify([
  {
    answers: {
      invoice_number: {type: 'text', span: [8, 16], confidence: 0.99, value: 'INV-2291'},
      due_date: {type: 'date', guess: 'net 30', value: '2026-10-02'},
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
    input: parseExtractionInput(RAW_EXTRACTION_INPUT),
    answers: parseExtractionOutput(RAW_EXTRACTION_OUTPUT),
    rawInput: RAW_EXTRACTION_INPUT,
    rawOutput: RAW_EXTRACTION_OUTPUT,
    ...overrides,
  };
}

describe('ExtractionTab', () => {
  it('renders the source and one row per field with its value', () => {
    render(<ExtractionTab extraction={makeExtraction()} />);

    expect(screen.getByText('Source')).toBeInTheDocument();
    expect(screen.getByText('Fields')).toBeInTheDocument();

    // Found in the source: highlighted there, with its confidence.
    expect(screen.getByText('The invoice ID')).toBeInTheDocument();
    expect(screen.getByText('99%')).toBeInTheDocument();
    expect(screen.getAllByText('Confidence')).toHaveLength(2);
    expect(
      screen.getAllByText('INV-2291').some(element => element.tagName === 'MARK')
    ).toBe(true);

    // Worked out from the terms, so labelled rather than highlighted.
    expect(screen.getByText('2026-10-02')).toBeInTheDocument();
    expect(screen.getByText('Inferred')).toBeInTheDocument();
    expect(screen.getByText('net 30')).toBeInTheDocument();

    // Not found: the rejected candidate is shown but not highlighted.
    expect(screen.getByText('po_number')).toBeInTheDocument();
    expect(screen.getByText('Not found')).toBeInTheDocument();
    expect(screen.getByText(/Rejected candidate/)).toBeInTheDocument();
    expect(
      screen.queryAllByText('Invoice').some(element => element.tagName === 'MARK')
    ).toBe(false);
  });

  it('links hovered fields and source values', async () => {
    render(<ExtractionTab extraction={makeExtraction()} />);

    const value = screen
      .getAllByText('INV-2291')
      .find(element => element.tagName === 'MARK')!;
    expect(value).not.toHaveAttribute('data-active');

    await userEvent.hover(screen.getByText('The invoice ID'));
    expect(value).toHaveAttribute('data-active');

    await userEvent.unhover(screen.getByText('The invoice ID'));
    expect(value).not.toHaveAttribute('data-active');

    // Hovering the value emphasizes its field's row.
    const description = screen.getByText('The invoice ID');
    expect(description.closest('[data-active]')).toBeNull();
    await userEvent.hover(value);
    expect(description.closest('[data-active]')).not.toBeNull();
  });

  it('shows the input and output raw', async () => {
    render(<ExtractionTab extraction={makeExtraction()} />);

    await userEvent.click(screen.getByRole('radio', {name: 'Raw'}));

    expect(screen.getByText('Raw Input')).toBeInTheDocument();
    expect(screen.getByText('Raw Output')).toBeInTheDocument();
    expect(screen.queryByText('Fields')).not.toBeInTheDocument();
  });

  it('lists the fields and shows the output raw when it cannot be read', () => {
    render(
      <ExtractionTab
        extraction={makeExtraction({answers: null, rawOutput: '{"error": "timeout"}'})}
      />
    );

    expect(screen.getByText('Source')).toBeInTheDocument();
    expect(screen.getByText('invoice_number')).toBeInTheDocument();
    expect(screen.getByText('Raw Output')).toBeInTheDocument();
    expect(screen.getByText(/timeout/)).toBeInTheDocument();
  });
});
