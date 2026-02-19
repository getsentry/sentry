import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {
  AssertionSuggestionCard,
  AssertionSuggestionCardPlaceholder,
} from 'sentry/views/alerts/rules/uptime/assertionSuggestionCard';
import {
  AssertionType,
  ComparisonType,
  OpType,
  type AssertionSuggestion,
} from 'sentry/views/alerts/rules/uptime/types';

function makeSuggestion(
  overrides: Partial<AssertionSuggestion> = {}
): AssertionSuggestion {
  return {
    assertion_type: AssertionType.STATUS_CODE,
    comparison: ComparisonType.EQUALS,
    expected_value: '200',
    confidence: 0.9,
    explanation: 'Checks for a healthy response',
    json_path: null,
    header_name: null,
    assertion_json: {
      op: OpType.STATUS_CODE_CHECK,
      id: 'test-1',
      operator: {cmp: ComparisonType.EQUALS},
      value: 200,
    },
    ...overrides,
  };
}

describe('AssertionSuggestionCard', () => {
  it('renders status_code assertion label', () => {
    const suggestion = makeSuggestion({
      assertion_type: AssertionType.STATUS_CODE,
      comparison: ComparisonType.EQUALS,
      expected_value: '200',
    });

    render(<AssertionSuggestionCard suggestion={suggestion} onApply={jest.fn()} />);

    expect(screen.getByText(/Status code/)).toBeInTheDocument();
    expect(screen.getByText(/200/)).toBeInTheDocument();
  });

  it('renders json_path assertion label', () => {
    const suggestion = makeSuggestion({
      assertion_type: AssertionType.JSON_PATH,
      comparison: ComparisonType.EQUALS,
      expected_value: 'active',
      json_path: '$.status',
    });

    render(<AssertionSuggestionCard suggestion={suggestion} onApply={jest.fn()} />);

    expect(screen.getByText(/\$\.status/)).toBeInTheDocument();
    expect(screen.getByText(/"active"/)).toBeInTheDocument();
  });

  it('renders json_path with always comparison as exists', () => {
    const suggestion = makeSuggestion({
      assertion_type: AssertionType.JSON_PATH,
      comparison: ComparisonType.ALWAYS,
      json_path: '$.data',
    });

    render(<AssertionSuggestionCard suggestion={suggestion} onApply={jest.fn()} />);

    expect(screen.getByText(/\$\.data/)).toBeInTheDocument();
    expect(screen.getByText(/exists/)).toBeInTheDocument();
  });

  it('renders header assertion label', () => {
    const suggestion = makeSuggestion({
      assertion_type: AssertionType.HEADER,
      comparison: ComparisonType.EQUALS,
      expected_value: 'application/json',
      header_name: 'Content-Type',
    });

    render(<AssertionSuggestionCard suggestion={suggestion} onApply={jest.fn()} />);

    expect(screen.getByText(/Content-Type/)).toBeInTheDocument();
    expect(screen.getByText(/"application\/json"/)).toBeInTheDocument();
  });

  it('renders header with always comparison as exists', () => {
    const suggestion = makeSuggestion({
      assertion_type: AssertionType.HEADER,
      comparison: ComparisonType.ALWAYS,
      header_name: 'X-Request-Id',
    });

    render(<AssertionSuggestionCard suggestion={suggestion} onApply={jest.fn()} />);

    expect(screen.getByText(/X-Request-Id/)).toBeInTheDocument();
    expect(screen.getByText(/exists/)).toBeInTheDocument();
  });

  it('renders confidence badge with success variant for >= 80%', () => {
    const suggestion = makeSuggestion({confidence: 0.9});

    render(<AssertionSuggestionCard suggestion={suggestion} onApply={jest.fn()} />);

    expect(screen.getByText(/90% confidence/)).toBeInTheDocument();
  });

  it('renders confidence badge with warning variant for >= 50%', () => {
    const suggestion = makeSuggestion({confidence: 0.6});

    render(<AssertionSuggestionCard suggestion={suggestion} onApply={jest.fn()} />);

    expect(screen.getByText(/60% confidence/)).toBeInTheDocument();
  });

  it('renders confidence badge with danger variant for < 50%', () => {
    const suggestion = makeSuggestion({confidence: 0.3});

    render(<AssertionSuggestionCard suggestion={suggestion} onApply={jest.fn()} />);

    expect(screen.getByText(/30% confidence/)).toBeInTheDocument();
  });

  it('renders explanation text', () => {
    const suggestion = makeSuggestion({explanation: 'This checks the status'});

    render(<AssertionSuggestionCard suggestion={suggestion} onApply={jest.fn()} />);

    expect(screen.getByText('This checks the status')).toBeInTheDocument();
  });

  it('calls onApply when Apply button is clicked', async () => {
    const onApply = jest.fn();
    const suggestion = makeSuggestion();

    render(<AssertionSuggestionCard suggestion={suggestion} onApply={onApply} />);

    await userEvent.click(screen.getByRole('button', {name: 'Apply'}));

    expect(onApply).toHaveBeenCalledTimes(1);
  });
});

describe('AssertionSuggestionCardPlaceholder', () => {
  it('renders 6 skeleton placeholders', () => {
    render(<AssertionSuggestionCardPlaceholder />);

    const placeholders = screen.getAllByTestId('loading-placeholder');
    expect(placeholders).toHaveLength(6);
  });
});
