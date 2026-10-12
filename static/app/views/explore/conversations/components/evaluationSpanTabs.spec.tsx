import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {
  EvaluationInputTab,
  EvaluationOutputTab,
} from 'sentry/views/explore/conversations/components/evaluationSpanTabs';

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
          state: 'I cannot log in.',
          questions: [{key: 'authIssue', kind: 'question', type: 'boolean'}],
        }}
      />
    );

    expect(screen.getByText('Evaluated Text')).toBeInTheDocument();
    expect(screen.getByText('I cannot log in.')).toBeInTheDocument();
    expect(screen.getByText('Questions')).toBeInTheDocument();
    expect(screen.getByText('authIssue')).toBeInTheDocument();
  });

  it('shows questions that are not a map raw', () => {
    render(
      <EvaluationInputTab
        raw={RAW_INPUT}
        input={{
          state: 'I cannot log in.',
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
