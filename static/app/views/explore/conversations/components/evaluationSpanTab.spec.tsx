import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {EvaluationTab} from 'sentry/views/explore/conversations/components/evaluationSpanTab';

const RAW_INPUT = JSON.stringify([
  {type: 'evaluation', state: 'I cannot log in.', rawOnlyInputKey: true},
]);

const RAW_OUTPUT = JSON.stringify([
  {type: 'evaluation', answers: {}, rawOnlyOutputKey: true},
]);

const INPUT = {
  state: [{parts: [{kind: 'text' as const, text: 'I cannot log in.'}]}],
  questions: [
    {
      key: 'authIssue',
      kind: 'question' as const,
      type: 'boolean',
      instructions: 'Is there a login problem?',
    },
  ],
};

describe('EvaluationTab', () => {
  it('renders the evaluated content above each question with its answer', () => {
    render(
      <EvaluationTab
        evaluation={{
          input: INPUT,
          answers: [{kind: 'boolean', key: 'authIssue', probability: 0.97}],
          rawInput: RAW_INPUT,
          rawOutput: RAW_OUTPUT,
        }}
      />
    );

    const content = screen.getByText('Evaluated Content');
    const results = screen.getByText('Results');
    expect(content.compareDocumentPosition(results)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    expect(screen.getByText('I cannot log in.')).toBeInTheDocument();
    expect(screen.getByText('authIssue')).toBeInTheDocument();
    expect(screen.getByText('boolean')).toBeInTheDocument();
    expect(screen.getByText('Is there a login problem?')).toBeInTheDocument();
    expect(screen.getByText('Yes')).toBeInTheDocument();
    expect(screen.queryByText('Input')).not.toBeInTheDocument();
    expect(screen.queryByText('Output')).not.toBeInTheDocument();
  });

  it('toggles between the pretty view and both raw messages', async () => {
    render(
      <EvaluationTab
        evaluation={{
          input: INPUT,
          answers: [{kind: 'boolean', key: 'authIssue', probability: 0.97}],
          rawInput: RAW_INPUT,
          rawOutput: RAW_OUTPUT,
        }}
      />
    );

    await userEvent.click(screen.getByRole('radio', {name: 'Raw'}));

    expect(screen.getByText('Input')).toBeInTheDocument();
    expect(screen.getByText(/rawOnlyInputKey/)).toBeInTheDocument();
    expect(screen.getByText('Output')).toBeInTheDocument();
    expect(screen.getByText(/rawOnlyOutputKey/)).toBeInTheDocument();
    expect(screen.queryByText('authIssue')).not.toBeInTheDocument();
    expect(screen.getAllByRole('radiogroup')).toHaveLength(1);

    await userEvent.click(screen.getByRole('radio', {name: 'Pretty'}));

    expect(screen.getByText('authIssue')).toBeInTheDocument();
  });

  it('shows the questions as unanswered when no output was recorded', () => {
    render(
      <EvaluationTab
        evaluation={{
          input: INPUT,
          answers: null,
          rawInput: RAW_INPUT,
          rawOutput: undefined,
        }}
      />
    );

    expect(screen.getByText('I cannot log in.')).toBeInTheDocument();
    expect(screen.getByText('authIssue')).toBeInTheDocument();
    expect(screen.getByText('No answer')).toBeInTheDocument();
  });

  it.each([
    {
      name: 'the input is unreadable',
      evaluation: {
        input: null,
        answers: [{kind: 'boolean' as const, key: 'authIssue', probability: 0.97}],
        rawInput: 'not json at all',
        rawOutput: RAW_OUTPUT,
      },
      input: 'not json at all',
      output: /rawOnlyOutputKey/,
    },
    {
      name: 'the questions are not a map',
      evaluation: {
        input: {
          state: INPUT.state,
          questions: [],
          invalidQuestions: {value: ['authIssueRawValue']},
        },
        answers: [{kind: 'boolean' as const, key: 'authIssue', probability: 0.97}],
        rawInput: RAW_INPUT,
        rawOutput: RAW_OUTPUT,
      },
      input: /rawOnlyInputKey/,
      output: /rawOnlyOutputKey/,
    },
    {
      name: 'the output is unreadable',
      evaluation: {
        input: INPUT,
        answers: null,
        rawInput: RAW_INPUT,
        rawOutput: 'rate limited',
      },
      input: /rawOnlyInputKey/,
      output: 'rate limited',
    },
  ])('shows both messages as recorded when $name', ({evaluation, input, output}) => {
    render(<EvaluationTab evaluation={evaluation} />);

    expect(screen.queryByText('Evaluated Content')).not.toBeInTheDocument();
    expect(screen.queryByText('Results')).not.toBeInTheDocument();
    expect(screen.getByText('Input')).toBeInTheDocument();
    expect(screen.getByText(input)).toBeInTheDocument();
    expect(screen.getByText('Output')).toBeInTheDocument();
    expect(screen.getByText(output)).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
  });

  it('shows an empty state when neither message was recorded', () => {
    render(
      <EvaluationTab
        evaluation={{
          input: null,
          answers: null,
          rawInput: undefined,
          rawOutput: undefined,
        }}
      />
    );

    expect(screen.getByText('No decision for this span')).toBeInTheDocument();
  });
});
