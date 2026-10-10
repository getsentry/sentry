import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {GlobalDrawer} from '@sentry/scraps/drawer';
import {PictureInPictureProvider} from '@sentry/scraps/pictureInPicture';

import {ConfigStore} from 'sentry/stores/configStore';
import {SeerExplorerChatStateProvider} from 'sentry/views/seerExplorer/seerExplorerChatStateContext';
import {SeerExplorerContextProvider} from 'sentry/views/seerExplorer/seerExplorerContextProvider';
import {SeerExplorerSessionsProvider} from 'sentry/views/seerExplorer/seerExplorerSessionContext';
import {useSeerExplorerContext} from 'sentry/views/seerExplorer/useSeerExplorerContext';

async function getSeerExplorerInput() {
  const editor = await screen.findByRole('combobox', {name: 'Ask Seer a question'});
  // user-event does not yet recognize contenteditable="plaintext-only".
  editor.setAttribute('contenteditable', 'true');
  return editor;
}

/** An "Ask Seer" entry point somewhere in the app. */
function AskSeerEntryPoint({label, prompt}: {label: string; prompt: string}) {
  const {openChatPrompt} = useSeerExplorerContext();
  return (
    <button
      type="button"
      onClick={() => openChatPrompt({prompt, context: {widget: 'p95 latency'}})}
    >
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
            </SeerExplorerContextProvider>
          </GlobalDrawer>
        </PictureInPictureProvider>
      </SeerExplorerChatStateProvider>
    </SeerExplorerSessionsProvider>
  );
}

describe('openChatPrompt', () => {
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

  it("shows the question as Seer's and sends it with the reply", async () => {
    render(tree(), {organization});

    await userEvent.click(await screen.findByRole('button', {name: 'ask-widget'}));

    expect(await screen.findByText('What about this widget?')).toBeInTheDocument();
    expect(postChat).not.toHaveBeenCalled();

    await userEvent.type(await getSeerExplorerInput(), 'why did it jump?');
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

      await userEvent.type(await getSeerExplorerInput(), 'why?');
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

    it('joins the conversation on screen when Explorer is open', async () => {
      render(tree(), {organization});

      await userEvent.click(await screen.findByRole('button', {name: 'open-explorer'}));
      expect(await screen.findByText('Earlier answer')).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', {name: 'ask-widget'}));
      expect(await screen.findByText('What about this widget?')).toBeInTheDocument();
      expect(screen.getByText('Earlier answer')).toBeInTheDocument();

      await userEvent.type(await getSeerExplorerInput(), 'why?');
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

  describe("when the conversation on screen can't take a reply", () => {
    beforeEach(() => {
      ConfigStore.set('user', UserFixture({id: '1'}));
      sessionStorage.setItem('seer-explorer-run-id', '8');
    });

    async function askAndReply() {
      await userEvent.click(await screen.findByRole('button', {name: 'open-explorer'}));
      await userEvent.click(await screen.findByRole('button', {name: 'ask-widget'}));
      expect(await screen.findByText('What about this widget?')).toBeInTheDocument();

      await userEvent.type(await getSeerExplorerInput(), 'why?');
      await userEvent.keyboard('{Enter}');
      await waitFor(() => {
        expect(postChat).toHaveBeenCalledWith(
          chatUrl,
          expect.objectContaining({
            data: expect.objectContaining({chat_prompt: 'What about this widget?'}),
          })
        );
      });
    }

    it("moves the question to a new chat from someone else's run", async () => {
      MockApiClient.addMockResponse({
        url: `${chatUrl}8/`,
        method: 'GET',
        body: {
          session: {
            run_id: 8,
            owner_user_id: 2,
            blocks: [
              {
                id: 'assistant-1',
                message: {role: 'assistant', content: 'Their answer'},
                timestamp: '2024-01-01T00:01:00Z',
              },
            ],
            status: 'completed',
            updated_at: '2024-01-01T00:01:00Z',
          },
        },
      });
      render(tree(), {organization});

      await askAndReply();
    });

    it('moves the question to a new chat from a run that failed to load', async () => {
      MockApiClient.addMockResponse({
        url: `${chatUrl}8/`,
        method: 'GET',
        statusCode: 500,
        body: {detail: 'Failed to fetch run state'},
      });
      render(tree(), {organization});

      await askAndReply();
    });
  });

  it('puts the cursor in the composer for each new question', async () => {
    render(tree(), {organization});

    await userEvent.click(await screen.findByRole('button', {name: 'ask-widget'}));
    const editor = await getSeerExplorerInput();
    await waitFor(() => expect(editor).toHaveFocus());

    // Explorer is already open now; clicking elsewhere must still hand focus back.
    await userEvent.click(screen.getByRole('button', {name: 'ask-dashboard'}));
    await waitFor(() => expect(editor).toHaveFocus());
  });

  it('keeps a question asked while the first reply is creating the run', async () => {
    let finishSend!: () => void;
    const postDelayed = MockApiClient.addMockResponse({
      url: chatUrl,
      method: 'POST',
      body: {run_id: 1},
      asyncDelay: new Promise<void>(resolve => {
        finishSend = resolve;
      }),
    });
    render(tree(), {organization});

    await userEvent.click(await screen.findByRole('button', {name: 'ask-widget'}));
    await userEvent.type(await getSeerExplorerInput(), 'why?');
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(postDelayed).toHaveBeenCalled());

    // Explorer is showing the unsaved chat, so a second question joins it.
    await userEvent.click(screen.getByRole('button', {name: 'ask-dashboard'}));
    expect(await screen.findByText('What about this dashboard?')).toBeInTheDocument();

    act(() => finishSend());
    await waitFor(() => expect(sessionStorage.getItem('seer-explorer-run-id')).toBe('1'));
    expect(screen.getByText('What about this dashboard?')).toBeInTheDocument();
  });

  it('puts the question back after every failed reply, so each attempt carries it', async () => {
    const postFailing = MockApiClient.addMockResponse({
      url: chatUrl,
      method: 'POST',
      statusCode: 500,
      body: {detail: 'Failed to start or continue chat session'},
    });
    render(tree(), {organization});

    await userEvent.click(await screen.findByRole('button', {name: 'ask-widget'}));
    const editor = await getSeerExplorerInput();
    await userEvent.type(editor, 'why?');
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(postFailing).toHaveBeenCalledTimes(1));

    // The failed reply is back in the composer and the question is back above it.
    await waitFor(() => expect(editor).toHaveTextContent(/^why\?$/));
    expect(screen.getByText('What about this widget?')).toBeInTheDocument();

    // Every failure puts it back, not only the first.
    for (const attempt of [2, 3]) {
      await waitFor(() => expect(editor).toHaveTextContent(/^why\?$/));
      await userEvent.click(editor);
      await userEvent.keyboard('{Enter}');
      await waitFor(() => expect(postFailing).toHaveBeenCalledTimes(attempt));
      expect(postFailing).toHaveBeenLastCalledWith(
        chatUrl,
        expect.objectContaining({
          data: expect.objectContaining({chat_prompt: 'What about this widget?'}),
        })
      );
    }
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
});
