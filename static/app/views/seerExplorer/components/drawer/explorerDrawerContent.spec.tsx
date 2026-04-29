import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {ConfigStore} from 'sentry/stores/configStore';
import {ExplorerDrawerContent} from 'sentry/views/seerExplorer/components/drawer/explorerDrawerContent';
import * as useSeerExplorerModule from 'sentry/views/seerExplorer/hooks/useSeerExplorer';

const mockGetPageReferrer = jest.fn().mockReturnValue('/issues/');

const defaultHookReturn: ReturnType<typeof useSeerExplorerModule.useSeerExplorer> = {
  sessionData: null,
  isPolling: false,
  isError: false,
  runId: null,
  waitingForInterrupt: false,
  overrideCtxEngEnable: true,
  overrideCodeModeEnable: 'off',
  sendMessage: jest.fn(),
  switchToRun: jest.fn(),
  startNewSession: jest.fn(),
  interruptRun: jest.fn(),
  respondToUserInput: jest.fn(),
  createPR: jest.fn(),
  setOverrideCtxEngEnable: jest.fn(),
  setOverrideCodeModeEnable: jest.fn(),
};

describe('ExplorerDrawerContent', () => {
  const organization = OrganizationFixture({
    openMembership: true,
    features: ['seer-explorer', 'gen-ai-features'],
    hideAiFeatures: false,
  });

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    sessionStorage.clear();
    jest.clearAllMocks();

    jest
      .spyOn(useSeerExplorerModule, 'useSeerExplorer')
      .mockReturnValue(defaultHookReturn);

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/explorer-runs/`,
      method: 'GET',
      body: {data: []},
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Empty State', () => {
    it('renders the drawer root element', () => {
      render(<ExplorerDrawerContent getPageReferrer={mockGetPageReferrer} />, {
        organization,
      });
      expect(document.querySelector('[data-seer-explorer-root]')).toBeInTheDocument();
    });

    it('shows empty state when no messages exist', async () => {
      render(<ExplorerDrawerContent getPageReferrer={mockGetPageReferrer} />, {
        organization,
      });
      expect(
        await screen.findByText('Ask Seer anything about your application.')
      ).toBeInTheDocument();
    });

    it('shows input', async () => {
      render(<ExplorerDrawerContent getPageReferrer={mockGetPageReferrer} />, {
        organization,
      });
      expect(
        await screen.findByPlaceholderText(
          'Ask Seer a question, or press / for commands.'
        )
      ).toBeInTheDocument();
    });

    it('sends the suggested question when a suggestion button is clicked', async () => {
      const sendMessage = jest.fn();
      jest.spyOn(useSeerExplorerModule, 'useSeerExplorer').mockReturnValue({
        ...defaultHookReturn,
        sendMessage,
      });

      render(<ExplorerDrawerContent getPageReferrer={mockGetPageReferrer} />, {
        organization,
      });

      const suggestion = await screen.findByRole('button', {
        name: 'Which of my open issues are getting worse, not better?',
      });
      await userEvent.click(suggestion);

      expect(sendMessage).toHaveBeenCalledWith(
        'Which of my open issues are getting worse, not better?'
      );
    });

    it('shows error state when isError is true', async () => {
      jest.spyOn(useSeerExplorerModule, 'useSeerExplorer').mockReturnValue({
        ...defaultHookReturn,
        runId: 123,
        isError: true,
      });

      render(<ExplorerDrawerContent getPageReferrer={mockGetPageReferrer} />, {
        organization,
      });

      expect(
        await screen.findByText('Error loading this session (ID=123).')
      ).toBeInTheDocument();
      expect(
        screen.queryByText('Ask Seer anything about your application.')
      ).not.toBeInTheDocument();
    });
  });

  describe('Messages Display', () => {
    it('renders user and assistant messages', async () => {
      jest.spyOn(useSeerExplorerModule, 'useSeerExplorer').mockReturnValue({
        ...defaultHookReturn,
        sessionData: {
          blocks: [
            {
              id: 'msg-1',
              message: {role: 'user', content: 'What is this error?'},
              timestamp: '2024-01-01T00:00:00Z',
              loading: false,
            },
            {
              id: 'msg-2',
              message: {role: 'assistant', content: 'This is a null pointer exception.'},
              timestamp: '2024-01-01T00:01:00Z',
              loading: false,
            },
          ],
          run_id: 123,
          status: 'completed',
          updated_at: '2024-01-01T00:01:00Z',
        } as useSeerExplorerModule.SeerExplorerResponse['session'],
      });

      render(<ExplorerDrawerContent getPageReferrer={mockGetPageReferrer} />, {
        organization,
      });

      expect(await screen.findByText('What is this error?')).toBeInTheDocument();
      expect(screen.getByText('This is a null pointer exception.')).toBeInTheDocument();
      expect(
        screen.queryByText('Ask Seer anything about your application.')
      ).not.toBeInTheDocument();
    });
  });

  describe('Input Handling', () => {
    it('can type in the textarea', async () => {
      render(<ExplorerDrawerContent getPageReferrer={mockGetPageReferrer} />, {
        organization,
      });
      const textarea = await screen.findByTestId('seer-explorer-input');
      await userEvent.type(textarea, 'Test message');
      expect(textarea).toHaveValue('Test message');
    });

    it('calls sendMessage and clears input when Enter is pressed', async () => {
      const sendMessage = jest.fn();
      jest.spyOn(useSeerExplorerModule, 'useSeerExplorer').mockReturnValue({
        ...defaultHookReturn,
        sendMessage,
      });

      render(<ExplorerDrawerContent getPageReferrer={mockGetPageReferrer} />, {
        organization,
      });

      const textarea = await screen.findByTestId('seer-explorer-input');
      await userEvent.type(textarea, 'Test message');
      await userEvent.keyboard('{Enter}');

      expect(sendMessage).toHaveBeenCalledWith('Test message');
      expect(textarea).toHaveValue('');
    });

    it('[Integration] sends message to the API when Enter is pressed', async () => {
      // e2e flow of sending a message to the API and receiving an updated response
      // Restore the spy so the real useSeerExplorer hook runs against mock API responses
      jest.restoreAllMocks();

      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/seer/explorer-chat/`,
        method: 'GET',
        body: {session: null},
      });

      const postMock = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/seer/explorer-chat/`,
        method: 'POST',
        body: {
          run_id: 999,
          message: {
            id: 'response-1',
            message: {role: 'assistant', content: 'Response content'},
            timestamp: '2024-01-01T00:01:00Z',
            loading: false,
          },
        },
      });

      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/seer/explorer-chat/999/`,
        method: 'GET',
        body: {
          session: {
            blocks: [
              {
                id: 'msg-1',
                message: {role: 'user', content: 'What is this error?'},
                timestamp: '2024-01-01T00:00:00Z',
                loading: false,
              },
              {
                id: 'msg-2',
                message: {
                  role: 'assistant',
                  content: 'This error indicates a null pointer exception.',
                },
                timestamp: '2024-01-01T00:01:00Z',
                loading: false,
              },
            ],
            run_id: 999,
            status: 'completed',
            updated_at: '2024-01-01T00:01:00Z',
          },
        },
      });

      render(<ExplorerDrawerContent getPageReferrer={mockGetPageReferrer} />, {
        organization,
      });

      const textarea = await screen.findByTestId('seer-explorer-input');
      await userEvent.type(textarea, 'What is this error?');
      await userEvent.keyboard('{Enter}');

      expect(postMock).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/seer/explorer-chat/`,
        expect.objectContaining({
          method: 'POST',
          data: expect.objectContaining({query: 'What is this error?'}),
        })
      );
    });

    it('does not send empty messages', async () => {
      const sendMessage = jest.fn();
      jest.spyOn(useSeerExplorerModule, 'useSeerExplorer').mockReturnValue({
        ...defaultHookReturn,
        sendMessage,
      });

      render(<ExplorerDrawerContent getPageReferrer={mockGetPageReferrer} />, {
        organization,
      });

      await screen.findByTestId('seer-explorer-input');
      await userEvent.keyboard('{Enter}');

      expect(sendMessage).not.toHaveBeenCalled();
    });

    it('does not send while polling', async () => {
      const sendMessage = jest.fn();
      jest.spyOn(useSeerExplorerModule, 'useSeerExplorer').mockReturnValue({
        ...defaultHookReturn,
        sendMessage,
        isPolling: true,
      });

      render(<ExplorerDrawerContent getPageReferrer={mockGetPageReferrer} />, {
        organization,
      });

      const textarea = await screen.findByTestId('seer-explorer-input');
      await userEvent.type(textarea, 'Test message');
      await userEvent.keyboard('{Enter}');

      expect(sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('Read-only State', () => {
    it('disables input when session owner differs from current user', async () => {
      ConfigStore.set('user', UserFixture({id: '1'}));
      jest.spyOn(useSeerExplorerModule, 'useSeerExplorer').mockReturnValue({
        ...defaultHookReturn,
        sessionData: {
          blocks: [],
          run_id: 999,
          status: 'completed',
          updated_at: '2024-01-01T00:00:00Z',
          owner_user_id: 2,
        } as useSeerExplorerModule.SeerExplorerResponse['session'],
      });

      render(<ExplorerDrawerContent getPageReferrer={mockGetPageReferrer} />, {
        organization,
      });

      const textarea = await screen.findByTestId('seer-explorer-input');
      await waitFor(() => expect(textarea).toBeDisabled());
      expect(textarea).toHaveAttribute(
        'placeholder',
        'This conversation is owned by another user and is read-only'
      );
    });

    it('enables input when owner id matches current user', async () => {
      ConfigStore.set('user', UserFixture({id: '1'}));
      jest.spyOn(useSeerExplorerModule, 'useSeerExplorer').mockReturnValue({
        ...defaultHookReturn,
        sessionData: {
          blocks: [],
          run_id: 999,
          status: 'completed',
          updated_at: '2024-01-01T00:00:00Z',
          owner_user_id: 1,
        } as useSeerExplorerModule.SeerExplorerResponse['session'],
      });

      render(<ExplorerDrawerContent getPageReferrer={mockGetPageReferrer} />, {
        organization,
      });

      const textarea = await screen.findByTestId('seer-explorer-input');
      await waitFor(() => expect(textarea).toBeEnabled());
      expect(textarea).toHaveAttribute(
        'placeholder',
        'Ask Seer a question, or press / for commands.'
      );
    });

    it('enables input when owner_user_id is undefined', async () => {
      ConfigStore.set('user', UserFixture({id: '1'}));
      jest.spyOn(useSeerExplorerModule, 'useSeerExplorer').mockReturnValue({
        ...defaultHookReturn,
        sessionData: {
          blocks: [],
          run_id: 999,
          status: 'completed',
          updated_at: '2024-01-01T00:00:00Z',
          owner_user_id: undefined,
        } as useSeerExplorerModule.SeerExplorerResponse['session'],
      });

      render(<ExplorerDrawerContent getPageReferrer={mockGetPageReferrer} />, {
        organization,
      });

      const textarea = await screen.findByTestId('seer-explorer-input');
      await waitFor(() => expect(textarea).toBeEnabled());
    });
  });

  describe('Context Engine Toggle', () => {
    const orgWithFlag = OrganizationFixture({
      openMembership: true,
      features: ['seer-explorer', 'seer-explorer-context-engine-fe-override-ui-flag'],
    });

    it('does not show toggle without the feature flag', async () => {
      render(<ExplorerDrawerContent getPageReferrer={mockGetPageReferrer} />, {
        organization,
      });
      await screen.findByTestId('seer-explorer-input');
      expect(
        screen.queryByRole('checkbox', {name: 'Toggle context engine'})
      ).not.toBeInTheDocument();
    });

    it('shows toggle when feature flag is enabled', async () => {
      render(<ExplorerDrawerContent getPageReferrer={mockGetPageReferrer} />, {
        organization: orgWithFlag,
      });
      expect(
        await screen.findByRole('checkbox', {name: 'Toggle context engine'})
      ).toBeInTheDocument();
    });
  });
});
