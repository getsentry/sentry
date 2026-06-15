import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ConversationMissingMessagesAlert} from 'sentry/views/explore/conversations/components/conversationMissingMessagesAlert';

describe('ConversationMissingMessagesAlert', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the missing messages alert', () => {
    render(<ConversationMissingMessagesAlert />);

    expect(
      screen.getByText('Missing the input and output of your conversations?')
    ).toBeInTheDocument();
  });

  it('hides the alert after dismissing it', async () => {
    render(<ConversationMissingMessagesAlert />);

    await userEvent.click(screen.getByRole('button', {name: 'Dismiss'}));

    expect(
      screen.queryByText('Missing the input and output of your conversations?')
    ).not.toBeInTheDocument();
  });
});
