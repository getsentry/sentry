import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {
  EvaluatedText,
  EvaluationAnswers,
  EvaluationQuestions,
  EvaluationResultSummary,
} from 'sentry/views/insights/pages/agents/components/evaluationContent';

describe('EvaluatedText', () => {
  it('renders the text without a Pretty/Raw toggle', async () => {
    render(<EvaluatedText state="I cannot log in." />);

    await userEvent.hover(screen.getByText('I cannot log in.'));

    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
  });
});

describe('EvaluationQuestions', () => {
  it('renders each question with its options', () => {
    render(
      <EvaluationQuestions
        questions={[
          {
            key: 'authIssue',
            kind: 'question',
            type: 'noul',
            instructions: 'Is there a login problem?',
          },
          {
            key: 'urgency',
            kind: 'question',
            type: 'score',
            criteria: ['low', 'medium', 'high'],
          },
          {
            key: 'department',
            kind: 'question',
            type: 'choice',
            criteria: {billing: 'Charges and refunds'},
          },
          {kind: 'invalid', key: 'tone', value: {criteria: 'friendly'}},
        ]}
      />
    );

    expect(screen.getByText('authIssue')).toBeInTheDocument();
    expect(screen.getByText('noul')).toBeInTheDocument();
    expect(screen.getByText('Is there a login problem?')).toBeInTheDocument();
    expect(screen.getByText('0 · low')).toBeInTheDocument();
    expect(screen.getByText('2 · high')).toBeInTheDocument();
    expect(screen.getByText('billing')).toBeInTheDocument();
    expect(screen.getByText('Charges and refunds')).toBeInTheDocument();
    expect(screen.getByText('tone')).toBeInTheDocument();
    expect(screen.getByText('Unrecognized')).toBeInTheDocument();
    expect(screen.getByText(/friendly/)).toBeInTheDocument();
  });
});

describe('EvaluationAnswers', () => {
  it('renders each answer with its question', () => {
    render(
      <EvaluationAnswers
        answers={[
          {kind: 'boolean', key: 'authIssue', probability: 0.97},
          {kind: 'boolean', key: 'wantsRefund', probability: 0.1},
          {
            kind: 'choice',
            key: 'department',
            choice: 'billing',
            probabilities: {technical: 0.35, billing: 0.59},
            confidence: 0.24,
          },
          {kind: 'invalid', key: 'custom', value: {stars: 4}},
        ]}
        questions={[
          {
            key: 'authIssue',
            kind: 'question',
            type: 'boolean',
            instructions: 'Is there a login problem?',
          },
        ]}
      />
    );

    expect(screen.getByText('Is there a login problem?')).toBeInTheDocument();
    expect(screen.getByText('Yes')).toBeInTheDocument();
    expect(screen.getByText('97%')).toBeInTheDocument();
    expect(screen.getByText('No')).toBeInTheDocument();
    expect(screen.getByText('90%')).toBeInTheDocument();
    // The chosen option is the highlighted row, not repeated in the header.
    expect(screen.getByText('billing')).toBeInTheDocument();
    expect(screen.getByText('59%')).toBeInTheDocument();
    expect(screen.getByText('technical')).toBeInTheDocument();
    expect(screen.getByText('Confidence: 24%')).toBeInTheDocument();
    expect(screen.getByText('custom')).toBeInTheDocument();
    expect(screen.getByText('Unrecognized')).toBeInTheDocument();
    expect(screen.getByText(/stars/)).toBeInTheDocument();
  });

  it('orders score values ascending and choices by probability', () => {
    render(
      <EvaluationAnswers
        answers={[
          {
            kind: 'score',
            key: 'urgency',
            score: 1.6,
            probabilities: {2: 0.61, 0: 0, 1: 0.39},
          },
          {
            kind: 'choice',
            key: 'department',
            choice: 'billing',
            probabilities: {technical: 0.38, billing: 0.62},
          },
        ]}
      />
    );

    expect(screen.getAllByText(/^\d+%$/).map(node => node.textContent)).toEqual([
      '0%',
      '39%',
      '61%',
      '62%',
      '38%',
    ]);
  });

  it('names score values after the question criteria', () => {
    render(
      <EvaluationAnswers
        answers={[
          {
            kind: 'score',
            key: 'urgency',
            score: 1.6,
            probabilities: {2: 0.61, 1: 0.39},
          },
        ]}
        questions={[
          {
            key: 'urgency',
            kind: 'question',
            type: 'score',
            criteria: ['low', 'medium', 'high'],
          },
        ]}
      />
    );

    expect(screen.getByText('high')).toBeInTheDocument();
    expect(screen.getByText('medium')).toBeInTheDocument();
    expect(screen.getByText('1.6')).toBeInTheDocument();
  });

  it('shows the answer in the header without a distribution', () => {
    render(
      <EvaluationAnswers
        answers={[
          {kind: 'score', key: 'urgency', score: 1.6, legend: {2: 'high'}},
          {kind: 'choice', key: 'department', choice: 'billing'},
        ]}
      />
    );

    expect(screen.getByText('high')).toBeInTheDocument();
    expect(screen.getByText('1.6')).toBeInTheDocument();
    expect(screen.getByText('billing')).toBeInTheDocument();
  });
});

describe('EvaluationResultSummary', () => {
  it('renders one tag per known answer', () => {
    render(
      <EvaluationResultSummary
        answers={[
          {kind: 'boolean', key: 'authIssue', probability: 0.97},
          {kind: 'score', key: 'urgency', score: 1.6},
          {kind: 'choice', key: 'department', choice: 'billing'},
          {kind: 'invalid', key: 'custom', value: {}},
        ]}
        questions={[
          {
            key: 'urgency',
            kind: 'question',
            type: 'score',
            criteria: ['low', 'medium', 'high'],
          },
        ]}
      />
    );

    expect(screen.getByText('authIssue: Yes')).toBeInTheDocument();
    expect(screen.getByText('urgency: high (1.6)')).toBeInTheDocument();
    expect(screen.getByText('department: billing')).toBeInTheDocument();
    expect(screen.queryByText(/custom/)).not.toBeInTheDocument();
  });
});
