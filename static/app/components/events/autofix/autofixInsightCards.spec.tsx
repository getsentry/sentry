import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import AutofixInsightCards from 'sentry/components/events/autofix/autofixInsightCards';
import type {AutofixInsight} from 'sentry/components/events/autofix/types';

jest.mock('sentry/utils/marked', () => ({
  singleLineRenderer: jest.fn(text => text),
}));

jest.mock('sentry/actionCreators/indicator');

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

beforeEach(() => {
  (addSuccessMessage as jest.Mock).mockClear();
  (addErrorMessage as jest.Mock).mockClear();
  MockApiClient.clearMockResponses();
});

describe('AutofixInsightCards', () => {
  const renderComponent = (props = {}) => {
    return render(
      <AutofixInsightCards
        insights={sampleInsights}
        repos={sampleRepos}
        hasStepAbove={false}
        hasStepBelow={false}
        groupId="1"
        runId="1"
        stepIndex={0}
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
    const contextButton = screen.getByText('Sample insight 1');
    await userEvent.click(contextButton);
    expect(screen.getByText('Breadcrumb body')).toBeInTheDocument();
    expect(screen.getByText('info')).toBeInTheDocument();
  });

  it('renders codebase context correctly', async () => {
    renderComponent();
    const contextButton = screen.getByText('Sample insight 1');
    await userEvent.click(contextButton);
    expect(screen.getByText('console.log("Hello, World!");')).toBeInTheDocument();
    expect(screen.getByText('src/index.js')).toBeInTheDocument();
  });

  it('renders stacktrace context correctly', async () => {
    renderComponent();
    const contextButton = screen.getByText('Sample insight 1');
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

  it('toggles context expansion correctly', async () => {
    renderComponent();
    const contextButton = screen.getByText('Sample insight 1');

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
      },
    ];
    renderComponent({insights: multipleInsights});
    expect(screen.getByText('Sample insight 1')).toBeInTheDocument();
    expect(screen.getByText('User message')).toBeInTheDocument();
    expect(screen.getByText('Another insight')).toBeInTheDocument();
  });

  it('renders "Rethink from here" buttons', () => {
    renderComponent();
    const rethinkButtons = screen.getAllByRole('button', {name: 'Rethink from here'});
    expect(rethinkButtons.length).toBeGreaterThan(0);
  });

  it('shows rethink input overlay when "Rethink from here" is clicked', async () => {
    renderComponent();
    const rethinkButton = screen.getByRole('button', {name: 'Rethink from here'});
    await userEvent.click(rethinkButton);
    expect(
      screen.getByPlaceholderText(
        'You should know X... Dive deeper into Y... Look at Z...'
      )
    ).toBeInTheDocument();
  });

  it('hides rethink input overlay when clicked outside', async () => {
    renderComponent();
    const rethinkButton = screen.getByRole('button', {name: 'Rethink from here'});
    await userEvent.click(rethinkButton);
    expect(
      screen.getByPlaceholderText(
        'You should know X... Dive deeper into Y... Look at Z...'
      )
    ).toBeInTheDocument();

    await userEvent.click(document.body);
    expect(
      screen.queryByPlaceholderText(
        'You should know X... Dive deeper into Y... Look at Z...'
      )
    ).not.toBeInTheDocument();
  });

  it('submits rethink request when form is submitted', async () => {
    const mockApi = MockApiClient.addMockResponse({
      url: '/issues/1/autofix/update/',
      method: 'POST',
    });

    renderComponent();
    const rethinkButton = screen.getByRole('button', {name: 'Rethink from here'});
    await userEvent.click(rethinkButton);

    const input = screen.getByPlaceholderText(
      'You should know X... Dive deeper into Y... Look at Z...'
    );
    await userEvent.type(input, 'Rethink this part');

    const submitButton = screen.getByLabelText(
      'Restart analysis from this point in the chain'
    );
    await userEvent.click(submitButton);

    expect(mockApi).toHaveBeenCalledWith(
      '/issues/1/autofix/update/',
      expect.objectContaining({
        method: 'POST',
        data: expect.objectContaining({
          run_id: '1',
          payload: expect.objectContaining({
            type: 'restart_from_point_with_feedback',
            message: 'Rethink this part',
            step_index: 0,
            retain_insight_card_index: 0,
          }),
        }),
      })
    );
  });

  it('shows success message after successful rethink submission', async () => {
    MockApiClient.addMockResponse({
      url: '/issues/1/autofix/update/',
      method: 'POST',
    });

    renderComponent();
    const rethinkButton = screen.getByRole('button', {name: 'Rethink from here'});
    await userEvent.click(rethinkButton);

    const input = screen.getByPlaceholderText(
      'You should know X... Dive deeper into Y... Look at Z...'
    );
    await userEvent.type(input, 'Rethink this part');

    const submitButton = screen.getByLabelText(
      'Restart analysis from this point in the chain'
    );
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(addSuccessMessage).toHaveBeenCalledWith('Thanks, rethinking this...');
    });
  });

  it('shows error message after failed rethink submission', async () => {
    MockApiClient.addMockResponse({
      url: '/issues/1/autofix/update/',
      method: 'POST',
      statusCode: 500,
    });

    renderComponent();
    const rethinkButton = screen.getByRole('button', {name: 'Rethink from here'});
    await userEvent.click(rethinkButton);

    const input = screen.getByPlaceholderText(
      'You should know X... Dive deeper into Y... Look at Z...'
    );
    await userEvent.type(input, 'Rethink this part');

    const submitButton = screen.getByLabelText(
      'Restart analysis from this point in the chain'
    );
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(addErrorMessage).toHaveBeenCalledWith(
        'Something went wrong when sending Autofix your message.'
      );
    });
  });
});
