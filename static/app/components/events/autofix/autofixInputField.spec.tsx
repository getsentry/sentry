import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {AutofixInputField} from 'sentry/components/events/autofix/autofixInputField';

describe('AutofixInputField', function () {
  const defaultProps = {
    groupId: '123',
    runId: '456',
  };

  it('renders the input field correctly', function () {
    render(<AutofixInputField {...defaultProps} />);

    // Check if the input field is present
    expect(
      screen.getByPlaceholderText('Rename the function foo_bar to fooBar')
    ).toBeInTheDocument();

    // Check if the send button is present
    expect(screen.getByText('Send')).toBeInTheDocument();
  });

  it('handles input change correctly', async function () {
    render(<AutofixInputField {...defaultProps} />);

    const inputField = screen.getByPlaceholderText(
      'Rename the function foo_bar to fooBar'
    );

    // Simulate user typing in the input field
    await userEvent.click(inputField);
    await userEvent.type(inputField, 'Change the variable name');

    // Check if the input field value has changed
    expect(inputField).toHaveValue('Change the variable name');
  });

  it('handles send button click correctly', async function () {
    const mockSendUpdate = MockApiClient.addMockResponse({
      url: '/issues/123/autofix/update/',
      method: 'POST',
    });

    render(<AutofixInputField {...defaultProps} />);

    const inputField = screen.getByPlaceholderText(
      'Rename the function foo_bar to fooBar'
    );
    const sendButton = screen.getByText('Send');

    // Simulate user typing in the input field
    await userEvent.click(inputField);
    await userEvent.type(inputField, 'Change the variable name');

    // Simulate user clicking the send button
    await userEvent.click(sendButton);

    // Check if the input field is disabled after clicking the send button
    expect(inputField).toBeDisabled();

    // Check if the API request was sent
    expect(mockSendUpdate).toHaveBeenCalledTimes(1);
  });
});
