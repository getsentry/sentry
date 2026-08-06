import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ConversationMissingMessagesAlert} from 'sentry/views/explore/conversations/components/conversationMissingMessagesAlert';

describe('ConversationMissingMessagesAlert', () => {
  it('renders the missing messages guidance', async () => {
    render(<ConversationMissingMessagesAlert />);

    expect(
      await screen.findByText('Capture Your Conversation Messages')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Copy Prompt for AI Agent'})
    ).toBeInTheDocument();
  });
});
