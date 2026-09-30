import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {GlobalDrawer} from '@sentry/scraps/drawer';
import {PictureInPictureProvider} from '@sentry/scraps/pictureInPicture';

import {CHAT_PROMPT_TTL_MS} from 'sentry/views/seerExplorer/chatPrompt';
import {useAskSeer} from 'sentry/views/seerExplorer/hooks/useAskSeer';
import {SeerExplorerChatStateProvider} from 'sentry/views/seerExplorer/seerExplorerChatStateContext';
import {SeerExplorerSessionsProvider} from 'sentry/views/seerExplorer/seerExplorerSessionContext';
import {
  SeerExplorerContextProvider,
  useSeerExplorerContext,
} from 'sentry/views/seerExplorer/useSeerExplorerContext';

/** An "Ask Seer" entry point somewhere in the app. */
function AskSeerEntryPoint({
  label,
  prompt,
  runId,
}: {
  label: string;
  prompt: string;
  runId?: number;
}) {
  const askSeer = useAskSeer({prompt, context: {widget: 'p95 latency'}, runId});
  return (
    <button type="button" onClick={askSeer}>
      {label}
    </button>
  );
}

/** Stands in for the top-bar toggle. */
function OpenExplorer() {
  const {openSeerExplorer} = useSeerExplorerContext();
  return (
    <button type="button" onClick={() => openSeerExplorer()}>
      open-explorer
    </button>
  );
}

function tree() {
  return (
    <SeerExplorerSessionsProvider>
      <SeerExplorerChatStateProvider>
        <PictureInPictureProvider>
          <GlobalDrawer>
            <SeerExplorerContextProvider>
              <OpenExplorer />
              <AskSeerEntryPoint label="ask-widget" prompt="What about this widget?" />
              <AskSeerEntryPoint
                label="ask-dashboard"
                prompt="What about this dashboard?"
              />
              <AskSeerEntryPoint label="ask-run-1" prompt="What about run 1?" runId={1} />
            </SeerExplorerContextProvider>
          </GlobalDrawer>
        </PictureInPictureProvider>
      </SeerExplorerChatStateProvider>
    </SeerExplorerSessionsProvider>
  );
}

describe('useAskSeer', () => {
  const organization = OrganizationFixture({
    openMembership: true,
    hideAiFeatures: false,
    features: ['seer-explorer'],
  });
  const chatUrl = `/organizations/${organization.slug}/seer/explorer-chat/`;

  let postChat!: jest.Mock;

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    sessionStorage.clear();
    localStorage.clear();

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

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("shows the question as Seer's and sends it with the reply", async () => {
    render(tree(), {organization});

    await userEvent.click(await screen.findByRole('button', {name: 'ask-widget'}));

    expect(await screen.findByText('What about this widget?')).toBeInTheDocument();
    expect(postChat).not.toHaveBeenCalled();

    await userEvent.type(screen.getByTestId('seer-explorer-input'), 'why did it jump?');
    await userEvent.keyboard('{Enter}');

    await waitFor(() => {
      expect(postChat).toHaveBeenCalledWith(
        chatUrl,
        expect.objectContaining({
          data: expect.objectContaining({
            query: 'why did it jump?',
            chat_prompt: 'What about this widget?',
            chat_prompt_context: JSON.stringify({widget: 'p95 latency'}),
          }),
        })
      );
    });
  });

  describe('with an earlier run in this tab', () => {
    let postExisting!: jest.Mock;

    beforeEach(() => {
      // The chat state restores its run id from session storage on mount.
      sessionStorage.setItem('seer-explorer-run-id', '7');
      MockApiClient.addMockResponse({
        url: `${chatUrl}7/`,
        method: 'GET',
        body: {
          session: {
            run_id: 7,
            blocks: [
              {
                id: 'user-1',
                message: {role: 'user', content: 'Earlier question'},
                timestamp: '2024-01-01T00:00:00Z',
              },
              {
                id: 'assistant-1',
                message: {role: 'assistant', content: 'Earlier answer'},
                timestamp: '2024-01-01T00:01:00Z',
              },
            ],
            status: 'completed',
            updated_at: '2024-01-01T00:01:00Z',
          },
        },
      });
      postExisting = MockApiClient.addMockResponse({
        url: `${chatUrl}7/`,
        method: 'POST',
        body: {run_id: 7},
      });
    });

    it('starts a new chat when Explorer is closed', async () => {
      render(tree(), {organization});

      await userEvent.click(await screen.findByRole('button', {name: 'ask-widget'}));
      expect(await screen.findByText('What about this widget?')).toBeInTheDocument();
      expect(screen.queryByText('Earlier answer')).not.toBeInTheDocument();

      await userEvent.type(screen.getByTestId('seer-explorer-input'), 'why?');
      await userEvent.keyboard('{Enter}');

      await waitFor(() => {
        expect(postChat).toHaveBeenCalledWith(
          chatUrl,
          expect.objectContaining({
            data: expect.objectContaining({chat_prompt: 'What about this widget?'}),
          })
        );
      });
      expect(postExisting).not.toHaveBeenCalled();
    });

    it('asks in the run it names, even with another conversation on screen', async () => {
      const postRun1 = MockApiClient.addMockResponse({
        url: `${chatUrl}1/`,
        method: 'POST',
        body: {run_id: 1},
      });
      render(tree(), {organization});

      await userEvent.click(await screen.findByRole('button', {name: 'open-explorer'}));
      expect(await screen.findByText('Earlier answer')).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', {name: 'ask-run-1'}));
      expect(await screen.findByText('What about run 1?')).toBeInTheDocument();
      expect(screen.queryByText('Earlier answer')).not.toBeInTheDocument();

      await userEvent.type(screen.getByTestId('seer-explorer-input'), 'change it');
      await userEvent.keyboard('{Enter}');

      await waitFor(() => {
        expect(postRun1).toHaveBeenCalledWith(
          `${chatUrl}1/`,
          expect.objectContaining({
            data: expect.objectContaining({chat_prompt: 'What about run 1?'}),
          })
        );
      });
      expect(postExisting).not.toHaveBeenCalled();
    });

    it('joins the conversation on screen when Explorer is open', async () => {
      render(tree(), {organization});

      await userEvent.click(await screen.findByRole('button', {name: 'open-explorer'}));
      expect(await screen.findByText('Earlier answer')).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', {name: 'ask-widget'}));
      expect(await screen.findByText('What about this widget?')).toBeInTheDocument();
      expect(screen.getByText('Earlier answer')).toBeInTheDocument();

      await userEvent.type(screen.getByTestId('seer-explorer-input'), 'why?');
      await userEvent.keyboard('{Enter}');

      await waitFor(() => {
        expect(postExisting).toHaveBeenCalledWith(
          `${chatUrl}7/`,
          expect.objectContaining({
            data: expect.objectContaining({chat_prompt: 'What about this widget?'}),
          })
        );
      });
    });
  });

  it('puts the cursor in the composer for each new question', async () => {
    render(tree(), {organization});

    await userEvent.click(await screen.findByRole('button', {name: 'ask-widget'}));
    const textarea = await screen.findByTestId('seer-explorer-input');
    await waitFor(() => expect(textarea).toHaveFocus());

    // Explorer is already open now; clicking elsewhere must still hand focus back.
    await userEvent.click(screen.getByRole('button', {name: 'ask-dashboard'}));
    await waitFor(() => expect(textarea).toHaveFocus());
  });

  it('keeps one question, replacing it on each click', async () => {
    render(tree(), {organization});

    await userEvent.click(await screen.findByRole('button', {name: 'ask-widget'}));
    await userEvent.click(screen.getByRole('button', {name: 'ask-widget'}));
    expect(await screen.findAllByText('What about this widget?')).toHaveLength(1);

    await userEvent.click(screen.getByRole('button', {name: 'ask-dashboard'}));
    expect(await screen.findByText('What about this dashboard?')).toBeInTheDocument();
    expect(screen.queryByText('What about this widget?')).not.toBeInTheDocument();
  });

  it('removes an unanswered question after its time is up, unless a reply is drafted', async () => {
    const openedAt = Date.now();
    const now = jest.spyOn(Date, 'now').mockReturnValue(openedAt);
    render(tree(), {organization});

    await userEvent.click(await screen.findByRole('button', {name: 'ask-widget'}));
    const textarea = await screen.findByTestId('seer-explorer-input');
    await userEvent.type(textarea, 'draft');

    // The tab comes back after the deadline while a reply is being written.
    now.mockReturnValue(openedAt + CHAT_PROMPT_TTL_MS);
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(screen.getByText('What about this widget?')).toBeInTheDocument();

    // Clearing the draft lets the expired question go.
    await userEvent.clear(textarea);
    await waitFor(() => {
      expect(screen.queryByText('What about this widget?')).not.toBeInTheDocument();
    });
  });
});
