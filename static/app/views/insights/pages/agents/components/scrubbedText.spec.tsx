import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {
  ScrubbedPlaceholdersProvider,
  ScrubbedText,
} from 'sentry/views/insights/pages/agents/components/scrubbedText';

describe('ScrubbedText', () => {
  it('explains scrubbed replacement texts in a tooltip', async () => {
    render(
      <ScrubbedPlaceholdersProvider
        value={new Map([['[email]', {remark: 's', ruleId: '@email:replace'}]])}
      >
        <ScrubbedText>Find the account for [email] and summarise it.</ScrubbedText>
      </ScrubbedPlaceholdersProvider>
    );

    await userEvent.hover(screen.getByText('[email]'));

    expect(
      await screen.findByText(/Replaced because of a data scrubbing rule/)
    ).toBeInTheDocument();
  });

  it('renders plain text without scrubbed placeholders', () => {
    render(<ScrubbedText>Contact [email] here</ScrubbedText>);

    expect(screen.getByText('Contact [email] here')).toBeInTheDocument();
  });
});
