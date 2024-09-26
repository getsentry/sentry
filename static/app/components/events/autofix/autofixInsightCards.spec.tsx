import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import AutofixInsightCards from 'sentry/components/events/autofix/autofixInsightCards';

jest.mock('sentry/utils/marked', () => ({
  singleLineRenderer: jest.fn(text => text),
}));

const sampleInsights = [
  {
    breadcrumb_context: [],
    codebase_context: [],
    error_message_context: ['Error message 1'],
    insight: 'Sample insight 1',
    justification: 'Sample justification 1',
    stacktrace_context: [],
  },
];

const sampleRepos = [
  {
    external_id: '1',
    name: 'sample-repo',
    default_branch: 'main',
    provider: 'github',
    url: 'github.com/org/sample-repo',
  },
];

describe('AutofixInsightCards', () => {
  const renderComponent = (props = {}) => {
    return render(
      <AutofixInsightCards
        insights={sampleInsights}
        repos={sampleRepos}
        hasStepAbove={false}
        hasStepBelow={false}
        {...props}
      />
    );
  };

  it('renders insights correctly', () => {
    renderComponent();
    expect(screen.getByText('Sample insight 1')).toBeInTheDocument();
  });

  it('expands context when clicked', async () => {
    renderComponent();
    const contextButton = screen.getByText('Context');
    await userEvent.click(contextButton);
    expect(screen.getByText('Sample justification 1')).toBeInTheDocument();
    expect(screen.getByText('`Error message 1`')).toBeInTheDocument();
  });
});
