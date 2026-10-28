import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {
  EvaluatedContent,
  EvaluationResults,
  EvaluationResultSummary,
} from 'sentry/views/insights/pages/agents/components/evaluationContent';

describe('EvaluatedContent', () => {
  it('renders the text without a Pretty/Raw toggle', async () => {
    render(
      <EvaluatedContent state={[{parts: [{kind: 'text', text: 'I cannot log in.'}]}]} />
    );

    await userEvent.hover(screen.getByText('I cannot log in.'));

    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
  });

  it('renders message text with a placeholder for each image', () => {
    render(
      <EvaluatedContent
        state={[
          {
            role: 'user',
            parts: [{kind: 'text', text: 'Is this image mostly red?'}, {kind: 'image'}],
          },
        ]}
      />
    );

    expect(screen.getByText('Is this image mostly red?')).toBeInTheDocument();
    expect(screen.getByText('Image')).toBeInTheDocument();
  });
});

describe('EvaluationResults', () => {
  it('pairs each question with its answer and type', () => {
    render(
      <EvaluationResults
        questions={[
          {
            key: 'authIssue',
            kind: 'question',
            type: 'noul',
            instructions: 'Is there a login problem?',
          },
        ]}
        answers={[{kind: 'boolean', key: 'authIssue', probability: 0.97}]}
      />
    );

    expect(screen.getAllByText('authIssue')).toHaveLength(1);
    expect(screen.getByText('noul')).toBeInTheDocument();
    expect(screen.getByText('Is there a login problem?')).toBeInTheDocument();
    expect(screen.getByText('Yes')).toBeInTheDocument();
  });

  it('types an answer without a question by its answer', () => {
    render(
      <EvaluationResults
        answers={[{kind: 'choice', key: 'department', choice: 'billing'}]}
      />
    );

    expect(screen.getByText('department')).toBeInTheDocument();
    expect(screen.getByText('choice')).toBeInTheDocument();
  });

  it('shows the allowed answers of an unanswered question', () => {
    render(
      <EvaluationResults
        questions={[
          {
            key: 'department',
            kind: 'question',
            type: 'choice',
            criteria: {billing: 'Charges and refunds', technical: 'Bugs'},
          },
        ]}
      />
    );

    expect(screen.getByText('No answer')).toBeInTheDocument();
    expect(screen.getByText('billing')).toBeInTheDocument();
    expect(screen.getByText('technical')).toBeInTheDocument();
  });

  it('shows option descriptions in a tooltip', async () => {
    render(
      <EvaluationResults
        questions={[
          {
            key: 'urgency',
            kind: 'question',
            type: 'score',
            criteria: ['low', 'medium', 'high'],
            descriptions: {2: 'Blocks the customer'},
          },
        ]}
        answers={[{kind: 'score', key: 'urgency', score: 2}]}
      />
    );

    expect(screen.getByText('0 · low')).toBeInTheDocument();
    expect(screen.queryByText('Blocks the customer')).not.toBeInTheDocument();

    await userEvent.hover(screen.getByText('2 · high'));

    expect(await screen.findByText('Blocks the customer')).toBeInTheDocument();
    expect(screen.getAllByText('2 · high')).toHaveLength(2);
  });

  it('names score values after the question criteria', () => {
    render(
      <EvaluationResults
        questions={[
          {
            key: 'urgency',
            kind: 'question',
            type: 'score',
            criteria: ['low', 'medium', 'high'],
          },
        ]}
        answers={[
          {kind: 'score', key: 'urgency', score: 1.6, probabilities: {2: 0.61, 1: 0.39}},
        ]}
      />
    );

    expect(screen.getByText('high')).toBeInTheDocument();
    expect(screen.getByText('1.6')).toBeInTheDocument();
    expect(screen.getByText('1 · medium')).toBeInTheDocument();
    expect(screen.getByText('2 · high')).toBeInTheDocument();
  });

  it('shows the label and description of a probability row in its tooltip', async () => {
    render(
      <EvaluationResults
        questions={[
          {
            key: 'department',
            kind: 'question',
            type: 'choice',
            criteria: {billing: 'Charges and refunds'},
          },
        ]}
        answers={[
          {
            kind: 'choice',
            key: 'department',
            choice: 'billing',
            probabilities: {billing: 0.8, technical: 0.2},
          },
        ]}
      />
    );

    await userEvent.hover(screen.getAllByText('billing')[1]!);

    expect(await screen.findByText('Charges and refunds')).toBeInTheDocument();
    expect(screen.getAllByText('billing')).toHaveLength(3);
  });

  it.each([
    {
      name: 'a boolean, from its probability',
      answer: {kind: 'boolean' as const, key: 'authIssue', probability: 0.1},
      expected: '90%',
    },
    {
      name: 'a score',
      answer: {kind: 'score' as const, key: 'urgency', score: 1, confidence: 0.24},
      expected: '24%',
    },
    {
      name: 'a choice',
      answer: {
        kind: 'choice' as const,
        key: 'department',
        choice: 'billing',
        confidence: 0.5,
      },
      expected: '50%',
    },
  ])('shows the confidence of $name', async ({answer, expected}) => {
    render(<EvaluationResults answers={[answer]} />);

    await userEvent.hover(screen.getByText(expected));

    expect(await screen.findByText('Confidence')).toBeInTheDocument();
  });

  it('shows no confidence when the answer has none', () => {
    render(
      <EvaluationResults
        answers={[{kind: 'choice', key: 'department', choice: 'billing'}]}
      />
    );

    expect(screen.queryByText(/%$/)).not.toBeInTheDocument();
  });

  it('orders score values ascending and choices by probability', () => {
    render(
      <EvaluationResults
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

  it('renders a refusal with a tooltip explaining it', async () => {
    render(
      <EvaluationResults
        questions={[
          {
            key: 'urgency',
            kind: 'question',
            type: 'score',
            instructions: 'How urgent is this ticket?',
          },
        ]}
        answers={[{kind: 'refusal', key: 'urgency'}]}
      />
    );

    expect(screen.getByText('How urgent is this ticket?')).toBeInTheDocument();
    await userEvent.hover(screen.getByText('Refused'));
    expect(await screen.findByText('The model declined to answer.')).toBeInTheDocument();
  });

  it('shows unrecognized questions and answers raw', () => {
    render(
      <EvaluationResults
        questions={[
          {kind: 'invalid', key: 'tone', value: {criteria: 'friendly'}},
          {key: 'custom', kind: 'question', type: 'rating'},
        ]}
        answers={[
          {kind: 'boolean', key: 'tone', probability: 0.8},
          {kind: 'invalid', key: 'custom', value: {stars: 4}},
        ]}
      />
    );

    expect(screen.getAllByText('Unrecognized')).toHaveLength(2);
    expect(screen.getByText(/friendly/)).toBeInTheDocument();
    expect(screen.getByText('Yes')).toBeInTheDocument();
    expect(screen.getByText('rating')).toBeInTheDocument();
    expect(screen.getByText(/stars/)).toBeInTheDocument();
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
          {kind: 'refusal', key: 'escalate'},
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
    expect(screen.getByText('escalate: Refused')).toBeInTheDocument();
    expect(screen.queryByText(/custom/)).not.toBeInTheDocument();
  });
});
