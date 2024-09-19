import {AutofixStepFixture} from 'sentry-fixture/autofixStep';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import AutofixMessageBox from 'sentry/components/events/autofix/autofixMessageBox';

jest.mock('sentry/actionCreators/indicator');

describe('AutofixMessageBox', () => {
  const defaultProps = {
    displayText: 'Test display text',
    groupId: '123',
    runId: '456',
    inputPlaceholder: 'Test placeholder',
    actionText: 'Send',
    isDisabled: false,
    allowEmptyMessage: false,
    responseRequired: false,
    step: null,
    onSend: null,
  };

  beforeEach(() => {
    (addSuccessMessage as jest.Mock).mockClear();
    (addErrorMessage as jest.Mock).mockClear();
    MockApiClient.clearMockResponses();
  });

  it('renders correctly with default props', () => {
    render(<AutofixMessageBox {...defaultProps} />);

    expect(screen.getByText('Test display text')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Test placeholder')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Send'})).toBeInTheDocument();
  });

  it('calls onSend when provided and button is clicked', async () => {
    const onSendMock = jest.fn();
    render(<AutofixMessageBox {...defaultProps} onSend={onSendMock} />);

    const input = screen.getByPlaceholderText('Test placeholder');
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

    const input = screen.getByPlaceholderText('Test placeholder');
    await userEvent.type(input, 'Test message');
    await userEvent.click(screen.getByRole('button', {name: 'Send'}));

    await waitFor(() => {
      expect(addSuccessMessage).toHaveBeenCalledWith(
        "Thanks for the input! I'll get to it right after this."
      );
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

    const input = screen.getByPlaceholderText('Test placeholder');
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

  it('disables input and button when isDisabled is true', () => {
    render(<AutofixMessageBox {...defaultProps} isDisabled />);

    expect(screen.getByPlaceholderText('Test placeholder')).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Send'})).toBeDisabled();
  });

  it('renders required input style when responseRequired is true', () => {
    render(<AutofixMessageBox {...defaultProps} responseRequired />);

    expect(
      screen.getByPlaceholderText('Please answer to continue...')
    ).toBeInTheDocument();
  });
});
