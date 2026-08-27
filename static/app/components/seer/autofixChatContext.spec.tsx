import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {GlobalDrawer} from '@sentry/scraps/drawer';
import {PictureInPictureProvider} from '@sentry/scraps/pictureInPicture';

import {useAutofixChat} from 'sentry/components/seer/autofixChatContext';
import {SeerExplorerChatStateProvider} from 'sentry/views/seerExplorer/seerExplorerChatStateContext';
import {SeerExplorerSessionsProvider} from 'sentry/views/seerExplorer/seerExplorerSessionContext';
import {SeerExplorerContextProvider} from 'sentry/views/seerExplorer/useSeerExplorerContext';

/**
 * Stands in for a button somewhere else in the app — issue details, say — that
 * wants to hand the agent a message. It renders outside the chat, so it only
 * ever sees the provider mounted by `SeerExplorerContextProvider`.
 */
function AskSeerButton({query}: {query: string}) {
  const {sendMessage} = useAutofixChat();
  return (
    <button type="button" disabled={!sendMessage} onClick={() => sendMessage?.(query)}>
      ask-seer
    </button>
  );
}

function tree(query: string) {
  return (
    <SeerExplorerSessionsProvider>
      <SeerExplorerChatStateProvider>
        <PictureInPictureProvider>
          <GlobalDrawer>
            <SeerExplorerContextProvider>
              <div>main app content</div>
              <AskSeerButton query={query} />
            </SeerExplorerContextProvider>
          </GlobalDrawer>
        </PictureInPictureProvider>
      </SeerExplorerChatStateProvider>
    </SeerExplorerSessionsProvider>
  );
}

describe('AutofixChatProvider', () => {
  const organization = OrganizationFixture({
    openMembership: true,
    hideAiFeatures: false,
    features: ['seer-explorer', 'gen-ai-features'],
  });

  const chatUrl = `/organizations/${organization.slug}/seer/explorer-chat/`;

  let postChat!: jest.Mock;

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    sessionStorage.clear();
    localStorage.clear();

    // No session yet, so the explorer opens empty and auto-submits the query.
    MockApiClient.addMockResponse({url: chatUrl, method: 'GET', body: {session: null}});
    postChat = MockApiClient.addMockResponse({
      url: chatUrl,
      method: 'POST',
      body: {run_id: 1},
    });
    MockApiClient.addMockResponse({
      url: `${chatUrl}1/`,
      method: 'GET',
      body: {session: {run_id: 1, blocks: [], status: 'completed', updated_at: ''}},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/runs/`,
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/`,
      method: 'GET',
      body: [],
    });
  });

  it('opens the explorer and submits the message from outside the chat', async () => {
    render(tree('Why is this issue spiking?'), {organization});

    expect(await screen.findByText('main app content')).toBeInTheDocument();
    // Nothing is open yet, so nothing has been sent.
    expect(postChat).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', {name: 'ask-seer'}));

    // The chat itself opens, and the message goes out as a real request.
    expect(await screen.findByTestId('seer-explorer-input')).toBeInTheDocument();
    await waitFor(() => {
      expect(postChat).toHaveBeenCalledWith(
        chatUrl,
        expect.objectContaining({
          method: 'POST',
          data: expect.objectContaining({query: 'Why is this issue spiking?'}),
        })
      );
    });
  });

  it('leaves the entry point disabled with no provider above it', () => {
    render(<AskSeerButton query="anything" />, {organization});

    expect(screen.getByRole('button', {name: 'ask-seer'})).toBeDisabled();
  });
});
