import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {GlobalDrawer} from '@sentry/scraps/drawer';
import {PictureInPictureProvider} from '@sentry/scraps/pictureInPicture';

import {useAutofixChat} from 'sentry/components/seer/autofixChatContext';
import * as useSeerExplorerModule from 'sentry/views/seerExplorer/hooks/useSeerExplorer';
import {SeerExplorerChatStateProvider} from 'sentry/views/seerExplorer/seerExplorerChatStateContext';
import {SeerExplorerSessionsProvider} from 'sentry/views/seerExplorer/seerExplorerSessionContext';
import {SeerExplorerContextProvider} from 'sentry/views/seerExplorer/useSeerExplorerContext';

const defaultHookReturn: ReturnType<typeof useSeerExplorerModule.useSeerExplorer> = {
  sessionData: null,
  isPolling: false,
  isError: false,
  errorStatusCode: undefined,
  isTimedOut: false,
  runId: null,
  overrideBashModeEnabled: false,
  overrideCtxEngEnable: true,
  overrideCodeModeEnable: 'off',
  hasSentInterrupt: false,
  sendMessage: jest.fn(),
  switchToRun: jest.fn(),
  startNewSession: jest.fn(),
  interruptRun: jest.fn(),
  respondToUserInput: jest.fn(),
  createPR: jest.fn(),
  setOverrideBashModeEnabled: jest.fn(),
  setOverrideCtxEngEnable: jest.fn(),
  setOverrideCodeModeEnable: jest.fn(),
};

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

  let sendMessage!: jest.Mock;

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    sessionStorage.clear();
    localStorage.clear();
    jest.clearAllMocks();

    sendMessage = jest.fn();
    jest
      .spyOn(useSeerExplorerModule, 'useSeerExplorer')
      .mockReturnValue({...defaultHookReturn, sendMessage});

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

  it('opens the explorer and submits the message from outside the chat', async () => {
    render(tree('Why is this issue spiking?'), {organization});

    expect(await screen.findByText('main app content')).toBeInTheDocument();
    // Nothing is open yet, so nothing has been sent.
    expect(sendMessage).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', {name: 'ask-seer'}));

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith(
        'Why is this issue spiking?',
        expect.any(Number)
      );
    });
  });

  it('enables the entry point wherever the provider is mounted', async () => {
    render(tree('anything'), {organization});

    expect(await screen.findByRole('button', {name: 'ask-seer'})).toBeEnabled();
  });

  it('leaves the entry point disabled with no provider above it', () => {
    render(<AskSeerButton query="anything" />, {organization});

    expect(screen.getByRole('button', {name: 'ask-seer'})).toBeDisabled();
  });
});
