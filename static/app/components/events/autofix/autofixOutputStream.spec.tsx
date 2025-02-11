import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';

import {AutofixOutputStream} from './autofixOutputStream';

jest.mock('sentry/actionCreators/indicator');

describe('AutofixOutputStream', () => {
  const mockApi = {
    requestPromise: jest.fn(),
  };

  beforeEach(() => {
    mockApi.requestPromise.mockReset();
    (addSuccessMessage as jest.Mock).mockClear();
    (addErrorMessage as jest.Mock).mockClear();
    MockApiClient.addMockResponse({
      url: '/issues/123/autofix/update/',
      method: 'POST',
    });
  });

  it('renders basic stream content', async () => {
    render(
      <AutofixOutputStream
        stream="Hello World"
        groupId="123"
        runId="456"
        isProcessing={false}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Hello World')).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText('Interrupt me...')).toBeInTheDocument();
  });

  it('renders active log when provided', async () => {
    render(
      <AutofixOutputStream
        stream="Stream content"
        activeLog="Active log message"
        groupId="123"
        runId="456"
        isProcessing
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Active log message')).toBeInTheDocument();
    });
  });

  it('shows required input placeholder when responseRequired is true', () => {
    render(<AutofixOutputStream stream="" groupId="123" runId="456" responseRequired />);

    expect(
      screen.getByPlaceholderText('Please answer to continue...')
    ).toBeInTheDocument();
  });

  it('prevents empty message submission', async () => {
    render(<AutofixOutputStream stream="Initial content" groupId="123" runId="456" />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', {name: 'Submit Comment'}));

    expect(mockApi.requestPromise).not.toHaveBeenCalled();
  });

  it('animates new stream content', async () => {
    const {rerender} = render(
      <AutofixOutputStream stream="Initial" groupId="123" runId="456" />
    );

    await waitFor(() => {
      expect(screen.getByText('Initial')).toBeInTheDocument();
    });

    rerender(
      <AutofixOutputStream stream="Initial content updated" groupId="123" runId="456" />
    );

    // Wait for animation to complete
    await waitFor(() => {
      expect(screen.getByText('Initial content updated')).toBeInTheDocument();
    });
  });

  it('handles user interruption', async () => {
    render(<AutofixOutputStream stream="Initial content" groupId="123" runId="456" />);

    const user = userEvent.setup();
    const input = screen.getByPlaceholderText('Interrupt me...');

    await user.type(input, 'Test message');
    await user.click(screen.getByRole('button', {name: 'Submit Comment'}));

    await waitFor(() => {
      expect(addSuccessMessage).toHaveBeenCalledWith('Thanks for the input.');
    });
  });

  it('shows error message when user interruption fails', async () => {
    MockApiClient.addMockResponse({
      url: '/issues/123/autofix/update/',
      method: 'POST',
      statusCode: 500,
    });

    render(<AutofixOutputStream stream="Initial content" groupId="123" runId="456" />);

    const user = userEvent.setup();
    const input = screen.getByPlaceholderText('Interrupt me...');

    await user.type(input, 'Test message');
    await user.click(screen.getByRole('button', {name: 'Submit Comment'}));

    await waitFor(() => {
      expect(addErrorMessage).toHaveBeenCalledWith(
        'Something went wrong when sending Autofix your message.'
      );
    });
  });
});
