import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ConversationMissingMessagesAlert} from 'sentry/views/explore/conversations/components/conversationMissingMessagesAlert';

const DOCS_LINK = 'https://docs.sentry.io/example/';

describe('ConversationMissingMessagesAlert', () => {
  it('links to the docs and offers the AI agent prompt', () => {
    render(<ConversationMissingMessagesAlert dismissKey="test" docsLink={DOCS_LINK} />);

    expect(
      screen.getByText(/This conversation's inputs and outputs weren't captured/)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', {name: 'Enable capturing inputs and outputs'})
    ).toHaveAttribute('href', DOCS_LINK);
    expect(
      screen.getByRole('button', {name: 'Copy Prompt for AI Agent'})
    ).toBeInTheDocument();
  });

  it('describes multiple conversations when plural', () => {
    render(
      <ConversationMissingMessagesAlert dismissKey="test" docsLink={DOCS_LINK} plural />
    );

    expect(
      screen.getByText(/These conversations' inputs and outputs weren't captured/)
    ).toBeInTheDocument();
  });

  it('removes its spacing along with the banner when dismissed', async () => {
    const {container} = render(
      <ConversationMissingMessagesAlert
        dismissKey="test"
        docsLink={DOCS_LINK}
        padding="0 xl xl"
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Dismiss banner'}));

    expect(container).toBeEmptyDOMElement();
  });
});
