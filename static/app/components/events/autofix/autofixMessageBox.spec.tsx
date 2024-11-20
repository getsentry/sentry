import {AutofixCodebaseChangeData} from 'sentry-fixture/autofixCodebaseChangeData';
import {AutofixStepFixture} from 'sentry-fixture/autofixStep';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import AutofixMessageBox from 'sentry/components/events/autofix/autofixMessageBox';
import {AutofixStepType} from 'sentry/components/events/autofix/types';

jest.mock('sentry/actionCreators/indicator');

describe('AutofixMessageBox', () => {
  const defaultProps = {
    displayText: 'Test display text',
    groupId: '123',
    runId: '456',
    actionText: 'Send',
    allowEmptyMessage: false,
    responseRequired: false,
    step: null,
    onSend: null,
  };

  const changesStepProps = {
    ...defaultProps,
    isChangesStep: true,
    step: AutofixStepFixture({
      type: AutofixStepType.CHANGES,
      changes: [AutofixCodebaseChangeData()],
    }),
  };

  const prCreatedProps = {
    ...changesStepProps,
    step: AutofixStepFixture({
      type: AutofixStepType.CHANGES,
      status: 'COMPLETED',
      changes: [AutofixCodebaseChangeData()],
    }),
  };

  const multiplePRsProps = {
    ...changesStepProps,
    step: AutofixStepFixture({
      type: AutofixStepType.CHANGES,
      status: 'COMPLETED',
      changes: [
        AutofixCodebaseChangeData({
          repo_name: 'example/repo1',
          pull_request: {
            pr_url: 'https://github.com/example/repo1/pull/1',
            pr_number: 1,
          },
        }),
        AutofixCodebaseChangeData({
          repo_name: 'example/repo1',
          pull_request: {
            pr_url: 'https://github.com/example/repo2/pull/2',
            pr_number: 2,
          },
        }),
      ],
    }),
  };

  beforeEach(() => {
    (addSuccessMessage as jest.Mock).mockClear();
    (addErrorMessage as jest.Mock).mockClear();
    MockApiClient.clearMockResponses();
  });

  it('renders correctly with default props', () => {
    render(<AutofixMessageBox {...defaultProps} />);

    expect(screen.getByText('Test display text')).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('Share helpful context or feedback...')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Send'})).toBeInTheDocument();
  });

  it('calls onSend when provided and button is clicked', async () => {
    const onSendMock = jest.fn();
    render(<AutofixMessageBox {...defaultProps} onSend={onSendMock} />);

    const input = screen.getByPlaceholderText('Share helpful context or feedback...');
    await userEvent.type(input, 'Test message');
    await userEvent.click(screen.getByRole('button', {name: 'Send'}));

    expect(onSendMock).toHaveBeenCalledWith('Test message');
  });

  it('sends interjection message when onSend is not provided', async () => {
    MockApiClient.addMockResponse({
      method: 'POST',
      url: '/issues/123/autofix/update/',
      body: {},
    });

    render(<AutofixMessageBox {...defaultProps} />);

    const input = screen.getByPlaceholderText('Share helpful context or feedback...');
    await userEvent.type(input, 'Test message');
    await userEvent.click(screen.getByRole('button', {name: 'Send'}));

    await waitFor(() => {
      expect(addSuccessMessage).toHaveBeenCalledWith('Thanks for the input.');
    });
  });

  it('displays error message when API request fails', async () => {
    MockApiClient.addMockResponse({
      url: '/issues/123/autofix/update/',
      method: 'POST',
      body: {
        detail: 'Internal Error',
      },
      statusCode: 500,
    });

    render(<AutofixMessageBox {...defaultProps} />);

    const input = screen.getByPlaceholderText('Share helpful context or feedback...');
    await userEvent.type(input, 'Test message');
    await userEvent.click(screen.getByRole('button', {name: 'Send'}));

    await waitFor(() => {
      expect(addErrorMessage).toHaveBeenCalledWith(
        'Something went wrong when sending Autofix your message.'
      );
    });
  });

  it('renders step icon and title when step is provided', () => {
    const stepProps = {
      ...defaultProps,
      step: AutofixStepFixture(),
    };

    render(<AutofixMessageBox {...stepProps} />);

    expect(screen.getByText(AutofixStepFixture().title)).toBeInTheDocument();
  });

  it('renders required input style when responseRequired is true', () => {
    render(<AutofixMessageBox {...defaultProps} responseRequired />);

    expect(
      screen.getByPlaceholderText('Please answer to continue...')
    ).toBeInTheDocument();
  });

  it('handles suggested root cause selection correctly', async () => {
    const onSendMock = jest.fn();
    render(
      <AutofixMessageBox {...defaultProps} onSend={onSendMock} isRootCauseSelectionStep />
    );

    // Test suggested root cause
    const input = screen.getByPlaceholderText(
      '(Optional) Provide any instructions for the fix...'
    );
    await userEvent.type(input, 'Use this suggestion');
    await userEvent.click(screen.getByRole('button', {name: 'Send'}));

    expect(onSendMock).toHaveBeenCalledWith('Use this suggestion', false);
  });

  it('handles custom root cause selection correctly', async () => {
    const onSendMock = jest.fn();
    render(
      <AutofixMessageBox {...defaultProps} onSend={onSendMock} isRootCauseSelectionStep />
    );

    // Test custom root cause
    await userEvent.click(screen.getAllByText('Propose your own root cause')[0]);
    const customInput = screen.getByPlaceholderText('Propose your own root cause...');
    await userEvent.type(customInput, 'Custom root cause');
    await userEvent.click(screen.getByRole('button', {name: 'Send'}));

    expect(onSendMock).toHaveBeenCalledWith('Custom root cause', true);
  });

  it('renders segmented control for changes step', () => {
    render(<AutofixMessageBox {...changesStepProps} />);

    expect(screen.getByRole('radio', {name: 'Give feedback'})).toBeInTheDocument();
    expect(screen.getByRole('radio', {name: 'Approve changes'})).toBeInTheDocument();
  });

  it('shows feedback input when "Give feedback" is selected', () => {
    render(<AutofixMessageBox {...changesStepProps} />);

    expect(
      screen.getByPlaceholderText('Share helpful context or feedback...')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Send'})).toBeInTheDocument();
  });

  it('shows "Create PR" button when "Approve changes" is selected', async () => {
    MockApiClient.addMockResponse({
      url: '/issues/123/autofix/setup/',
      method: 'GET',
      body: {
        genAIConsent: {ok: true},
        integration: {ok: true},
        githubWriteIntegration: {
          repos: [{ok: true, owner: 'owner', name: 'hello-world', id: 100}],
        },
      },
    });

    render(<AutofixMessageBox {...changesStepProps} />);

    await userEvent.click(screen.getByRole('radio', {name: 'Approve changes'}));

    expect(
      screen.getByText('Draft 1 pull request for the above changes?')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Create PR'})).toBeInTheDocument();
  });

  it('shows "Create PRs" button with correct text for multiple changes', async () => {
    MockApiClient.addMockResponse({
      url: '/issues/123/autofix/setup/',
      method: 'GET',
      body: {
        genAIConsent: {ok: true},
        integration: {ok: true},
        githubWriteIntegration: {
          repos: [{ok: true, owner: 'owner', name: 'hello-world', id: 100}],
        },
      },
    });

    const multipleChangesProps = {
      ...changesStepProps,
      step: {
        ...changesStepProps.step,
        changes: [AutofixCodebaseChangeData(), AutofixCodebaseChangeData()],
      },
    };

    render(<AutofixMessageBox {...multipleChangesProps} />);

    await userEvent.click(screen.getByRole('radio', {name: 'Approve changes'}));

    expect(
      screen.getByText('Draft 2 pull requests for the above changes?')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Create PRs'})).toBeInTheDocument();
  });

  it('shows "View PR" buttons when PRs are created', () => {
    render(<AutofixMessageBox {...prCreatedProps} />);

    expect(screen.getByRole('button', {name: /View PR in/})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: /View PR in/})).toHaveAttribute(
      'href',
      'https://github.com/owner/hello-world/pull/200'
    );
  });

  it('shows multiple "View PR" buttons for multiple PRs', () => {
    render(<AutofixMessageBox {...multiplePRsProps} />);

    const viewPRButtons = screen.getAllByRole('button', {name: /View PR in/});
    expect(viewPRButtons).toHaveLength(2);
    expect(viewPRButtons[0]).toHaveAttribute(
      'href',
      'https://github.com/example/repo1/pull/1'
    );
    expect(viewPRButtons[1]).toHaveAttribute(
      'href',
      'https://github.com/example/repo2/pull/2'
    );
  });

  it('shows "Create PRs" button that opens setup modal when setup is incomplete', async () => {
    MockApiClient.addMockResponse({
      url: '/issues/123/autofix/setup/',
      method: 'GET',
      body: {
        genAIConsent: {ok: true},
        integration: {ok: true},
        githubWriteIntegration: {
          repos: [
            {ok: false, provider: 'github', owner: 'owner', name: 'hello-world', id: 100},
          ],
        },
      },
    });

    render(<AutofixMessageBox {...changesStepProps} />);

    await userEvent.click(screen.getByRole('radio', {name: 'Approve changes'}));

    expect(
      screen.getByText('Draft 1 pull request for the above changes?')
    ).toBeInTheDocument();

    const createPRsButton = screen.getByRole('button', {name: 'Create PRs'});
    expect(createPRsButton).toBeInTheDocument();

    renderGlobalModal();
    await userEvent.click(createPRsButton);

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(
      within(screen.getByRole('dialog')).getByText('Allow Autofix to Make Pull Requests')
    ).toBeInTheDocument();
  });

  it('shows segmented control with "Add tests" option for changes step', () => {
    render(<AutofixMessageBox {...changesStepProps} />);

    expect(screen.getByRole('radio', {name: 'Give feedback'})).toBeInTheDocument();
    expect(screen.getByRole('radio', {name: 'Add tests'})).toBeInTheDocument();
    expect(screen.getByRole('radio', {name: 'Approve changes'})).toBeInTheDocument();
  });

  it('shows "Add Tests" button and static message when "Add tests" is selected', async () => {
    render(<AutofixMessageBox {...changesStepProps} />);

    await userEvent.click(screen.getByRole('radio', {name: 'Add tests'}));

    expect(
      screen.getByText('Write unit tests to make sure the issue is fixed?')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Add Tests'})).toBeInTheDocument();
  });

  it('sends correct message when "Add Tests" is clicked without onSend prop', async () => {
    MockApiClient.addMockResponse({
      method: 'POST',
      url: '/issues/123/autofix/update/',
      body: {},
    });

    render(<AutofixMessageBox {...changesStepProps} />);

    await userEvent.click(screen.getByRole('radio', {name: 'Add tests'}));
    await userEvent.click(screen.getByRole('button', {name: 'Add Tests'}));

    await waitFor(() => {
      expect(addSuccessMessage).toHaveBeenCalledWith('Thanks for the input.');
    });
  });
});
