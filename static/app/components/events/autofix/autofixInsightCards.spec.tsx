import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import AutofixInsightCards from 'sentry/components/events/autofix/autofixInsightCards';
import type {AutofixInsight} from 'sentry/components/events/autofix/types';

jest.mock('sentry/utils/marked', () => ({
  singleLineRenderer: jest.fn(text => text),
}));

const sampleInsights: AutofixInsight[] = [
  {
    breadcrumb_context: [
      {
        body: 'Breadcrumb body',
        category: 'ui',
        level: 'info',
        data_as_json: '{"testData": "testValue"}',
        type: 'info',
      },
    ],
    codebase_context: [
      {
        snippet: 'console.log("Hello, World!");',
        repo_name: 'sample-repo',
        file_path: 'src/index.js',
      },
    ],
    error_message_context: ['Error message 1'],
    insight: 'Sample insight 1',
    justification: 'Sample justification 1',
    stacktrace_context: [
      {
        code_snippet: 'function() { throw new Error("Test error"); }',
        repo_name: 'sample-repo',
        file_name: 'src/error.js',
        vars_as_json: '{"testVar": "testValue"}',
        col_no: 1,
        line_no: 1,
        function: 'testFunction',
      },
    ],
  },
  {
    insight: 'User message',
    justification: 'USER',
    breadcrumb_context: [],
    stacktrace_context: [],
    codebase_context: [],
    error_message_context: [],
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
    expect(screen.getByText('User message')).toBeInTheDocument();
  });

  it('renders breadcrumb context correctly', async () => {
    renderComponent();
    const contextButton = screen.getByText('Context');
    await userEvent.click(contextButton);
    expect(screen.getByText('Breadcrumb body')).toBeInTheDocument();
    expect(screen.getByText('info')).toBeInTheDocument();
  });

  it('renders codebase context correctly', async () => {
    renderComponent();
    const contextButton = screen.getByText('Context');
    await userEvent.click(contextButton);
    expect(screen.getByText('console.log("Hello, World!");')).toBeInTheDocument();
    expect(screen.getByText('src/index.js')).toBeInTheDocument();
  });

  it('renders stacktrace context correctly', async () => {
    renderComponent();
    const contextButton = screen.getByText('Context');
    await userEvent.click(contextButton);
    expect(
      screen.getByText('function() { throw new Error("Test error"); }')
    ).toBeInTheDocument();
    expect(screen.getByText('src/error.js')).toBeInTheDocument();
    expect(screen.getByText('testVar')).toBeInTheDocument();
  });

  it('renders user messages differently', () => {
    renderComponent();
    const userMessage = screen.getByText('User message');
    expect(userMessage.closest('div')).toHaveStyle('color: inherit');
  });

  it('renders "No insights yet" message when there are no insights', () => {
    renderComponent({insights: []});
    expect(
      screen.getByText(/Autofix will share important conclusions here/)
    ).toBeInTheDocument();
  });

  it('toggles context expansion correctly', async () => {
    renderComponent();
    const contextButton = screen.getByText('Context');

    await userEvent.click(contextButton);
    expect(screen.getByText('Sample justification 1')).toBeInTheDocument();

    await userEvent.click(contextButton);
    expect(screen.queryByText('Sample justification 1')).not.toBeInTheDocument();
  });

  it('renders multiple insights correctly', () => {
    const multipleInsights = [
      ...sampleInsights,
      {
        insight: 'Another insight',
        justification: 'Another justification',
        error_message_context: ['Another error message'],
      },
    ];
    renderComponent({insights: multipleInsights});
    expect(screen.getByText('Sample insight 1')).toBeInTheDocument();
    expect(screen.getByText('User message')).toBeInTheDocument();
    expect(screen.getByText('Another insight')).toBeInTheDocument();
  });
});
