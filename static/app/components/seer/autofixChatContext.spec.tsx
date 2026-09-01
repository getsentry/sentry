import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {GlobalDrawer} from '@sentry/scraps/drawer';
import {PictureInPictureProvider} from '@sentry/scraps/pictureInPicture';

import {useAutofixChat} from 'sentry/components/seer/autofixChatContext';
import {SeerExplorerChatStateProvider} from 'sentry/views/seerExplorer/seerExplorerChatStateContext';
import {SeerExplorerSessionsProvider} from 'sentry/views/seerExplorer/seerExplorerSessionContext';
import {SeerExplorerContextProvider} from 'sentry/views/seerExplorer/useSeerExplorerContext';

/**
 * A button elsewhere in the app. It renders outside the chat, so it only sees
 * the provider mounted by `SeerExplorerContextProvider`.
 */
function AskSeerButton({query, newChat}: {query: string; newChat?: boolean}) {
  const {sendMessage} = useAutofixChat();
  return (
    <button
      type="button"
      disabled={!sendMessage}
      onClick={() => sendMessage?.(query, {newChat})}
    >
      ask-seer
    </button>
  );
}

function tree(query: string, newChat?: boolean) {
  return (
    <SeerExplorerSessionsProvider>
      <SeerExplorerChatStateProvider>
        <PictureInPictureProvider>
          <GlobalDrawer>
            <SeerExplorerContextProvider>
              <div>main app content</div>
              <AskSeerButton query={query} newChat={newChat} />
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

  it('adds to the run already in progress by default', async () => {
    // The chat state restores its run id from session storage on mount, which is
    // what makes this an open conversation rather than a fresh one.
    sessionStorage.setItem('seer-explorer-run-id', '7');
    MockApiClient.addMockResponse({
      url: `${chatUrl}7/`,
      method: 'GET',
      body: {session: {run_id: 7, blocks: [], status: 'completed', updated_at: ''}},
    });
    const postExisting = MockApiClient.addMockResponse({
      url: `${chatUrl}7/`,
      method: 'POST',
      body: {run_id: 7},
    });

    render(tree('Follow up on that'), {organization});
    await userEvent.click(await screen.findByRole('button', {name: 'ask-seer'}));

    await waitFor(() => {
      expect(postExisting).toHaveBeenCalledWith(
        `${chatUrl}7/`,
        expect.objectContaining({
          data: expect.objectContaining({query: 'Follow up on that'}),
        })
      );
    });
    // The open conversation was kept, not swapped for a fresh one.
    expect(postChat).not.toHaveBeenCalled();
  });

  it('starts a fresh conversation with newChat', async () => {
    sessionStorage.setItem('seer-explorer-run-id', '7');
    MockApiClient.addMockResponse({
      url: `${chatUrl}7/`,
      method: 'GET',
      body: {session: {run_id: 7, blocks: [], status: 'completed', updated_at: ''}},
    });
    const postExisting = MockApiClient.addMockResponse({
      url: `${chatUrl}7/`,
      method: 'POST',
      body: {run_id: 7},
    });

    render(tree('Start over', true), {organization});
    await userEvent.click(await screen.findByRole('button', {name: 'ask-seer'}));

    // Posting to the collection URL (no run id) is what starts a new run.
    await waitFor(() => {
      expect(postChat).toHaveBeenCalledWith(
        chatUrl,
        expect.objectContaining({data: expect.objectContaining({query: 'Start over'})})
      );
    });
    expect(postExisting).not.toHaveBeenCalled();
  });

  it('leaves the entry point disabled with no provider above it', () => {
    render(<AskSeerButton query="anything" />, {organization});

    expect(screen.getByRole('button', {name: 'ask-seer'})).toBeDisabled();
  });
});
