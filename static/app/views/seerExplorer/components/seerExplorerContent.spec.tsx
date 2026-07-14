import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {PictureInPictureProvider} from '@sentry/scraps/pictureInPicture';

import {ConfigStore} from 'sentry/stores/configStore';
import {
  INPUT_STORAGE_KEY_PREFIX,
  SeerExplorerContent,
} from 'sentry/views/seerExplorer/components/seerExplorerContent';
import * as useSeerExplorerModule from 'sentry/views/seerExplorer/hooks/useSeerExplorer';
import {SeerExplorerSessionsProvider} from 'sentry/views/seerExplorer/seerExplorerSessionContext';
import type {SeerExplorerResponse} from 'sentry/views/seerExplorer/types';

const mockGetPageReferrer = jest.fn().mockReturnValue('/issues/');

const defaultHookReturn: ReturnType<typeof useSeerExplorerModule.useSeerExplorer> = {
  sessionData: null,
  isPolling: false,
  isError: false,
  errorStatusCode: undefined,
  isTimedOut: false,
  runId: null,
  overrideCtxEngEnable: true,
  overrideCodeModeEnable: 'off',
  hasSentInterrupt: false,
  sendMessage: jest.fn(),
  switchToRun: jest.fn(),
  startNewSession: jest.fn(),
  interruptRun: jest.fn(),
  respondToUserInput: jest.fn(),
  createPR: jest.fn(),
  setOverrideCtxEngEnable: jest.fn(),
  setOverrideCodeModeEnable: jest.fn(),
};

describe('SeerExplorerContent', () => {
  const organization = OrganizationFixture({
    openMembership: true,
    features: ['seer-explorer', 'gen-ai-features'],
    hideAiFeatures: false,
  });

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    sessionStorage.clear();
    jest.clearAllMocks();

    // The header collapses its actions into an overflow menu on narrow
    // containers (resolved via `useContainerBreakpoint`, which measures
    // `clientWidth` — an accessor on Element.prototype). Fake a wide container
    // so the expanded header — with its inline pop-out/dock buttons — renders
    // for these tests. The spy is undone by `jest.restoreAllMocks()` below.
    jest.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(800);

    jest
      .spyOn(useSeerExplorerModule, 'useSeerExplorer')
      .mockReturnValue(defaultHookReturn);

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/runs/`,
      method: 'GET',
      body: [],
    });

    // Slack integration lookup that drives the reinstall nudge.
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/`,
      method: 'GET',
      body: [],
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Empty State', () => {
    it('renders the drawer root element', async () => {
      render(
        <PictureInPictureProvider>
          <SeerExplorerSessionsProvider>
            <SeerExplorerContent
              getPageReferrer={mockGetPageReferrer}
              onClose={() => {}}
            />
          </SeerExplorerSessionsProvider>
        </PictureInPictureProvider>,
        {
          organization,
        }
      );
      await screen.findByTestId('seer-explorer-input');
      expect(document.querySelector('[data-seer-explorer-root]')).toBeInTheDocument();
    });

    it('shows empty state when no messages exist', async () => {
      render(
        <PictureInPictureProvider>
          <SeerExplorerSessionsProvider>
            <SeerExplorerContent
              getPageReferrer={mockGetPageReferrer}
              onClose={() => {}}
            />
          </SeerExplorerSessionsProvider>
        </PictureInPictureProvider>,
        {
          organization,
        }
      );
      expect(
        await screen.findByText('Ask Seer anything about your application.')
      ).toBeInTheDocument();
    });

    it('shows input', async () => {
      render(
        <PictureInPictureProvider>
          <SeerExplorerSessionsProvider>
            <SeerExplorerContent
              getPageReferrer={mockGetPageReferrer}
              onClose={() => {}}
            />
          </SeerExplorerSessionsProvider>
        </PictureInPictureProvider>,
        {
          organization,
        }
      );
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

      render(
        <PictureInPictureProvider>
          <SeerExplorerSessionsProvider>
            <SeerExplorerContent
              getPageReferrer={mockGetPageReferrer}
              onClose={() => {}}
            />
          </SeerExplorerSessionsProvider>
        </PictureInPictureProvider>,
        {
          organization,
        }
      );

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
        errorStatusCode: undefined,
      });

      render(
        <PictureInPictureProvider>
          <SeerExplorerSessionsProvider>
            <SeerExplorerContent
              getPageReferrer={mockGetPageReferrer}
              onClose={() => {}}
            />
          </SeerExplorerSessionsProvider>
        </PictureInPictureProvider>,
        {
          organization,
        }
      );

      expect(
        await screen.findByText(/Error loading this session \(run_id=123\)./)
      ).toBeInTheDocument();
    });

    it('shows 404-specific error message', async () => {
      jest.spyOn(useSeerExplorerModule, 'useSeerExplorer').mockReturnValue({
        ...defaultHookReturn,
        runId: 123,
        isError: true,
        errorStatusCode: 404,
      });

      render(
        <PictureInPictureProvider>
          <SeerExplorerSessionsProvider>
            <SeerExplorerContent
              getPageReferrer={mockGetPageReferrer}
              onClose={() => {}}
            />
          </SeerExplorerSessionsProvider>
        </PictureInPictureProvider>,
        {
          organization,
        }
      );

      expect(
        await screen.findByText(/Session not found \(run_id=123\)./)
      ).toBeInTheDocument();
      expect(screen.queryByText(/404/)).not.toBeInTheDocument();
    });

    it('shows generic error message when for non-404 errors', async () => {
      jest.spyOn(useSeerExplorerModule, 'useSeerExplorer').mockReturnValue({
        ...defaultHookReturn,
        runId: 123,
        isError: true,
        errorStatusCode: 444,
      });

      render(
        <PictureInPictureProvider>
          <SeerExplorerSessionsProvider>
            <SeerExplorerContent
              getPageReferrer={mockGetPageReferrer}
              onClose={() => {}}
            />
          </SeerExplorerSessionsProvider>
        </PictureInPictureProvider>,
        {
          organization,
        }
      );

      expect(
        await screen.findByText(/Error loading this session \(run_id=123\)./)
      ).toBeInTheDocument();
      expect(screen.queryByText(/444/)).not.toBeInTheDocument();
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
              message: {
                role: 'assistant',
                content: 'This is a null pointer exception.',
              },
              timestamp: '2024-01-01T00:01:00Z',
              loading: false,
            },
          ],
          run_id: 123,
          status: 'completed',
          updated_at: '2024-01-01T00:01:00Z',
        } as SeerExplorerResponse['session'],
      });

      render(
        <PictureInPictureProvider>
          <SeerExplorerSessionsProvider>
            <SeerExplorerContent
              getPageReferrer={mockGetPageReferrer}
              onClose={() => {}}
            />
          </SeerExplorerSessionsProvider>
        </PictureInPictureProvider>,
        {
          organization,
        }
      );

      expect(await screen.findByText('What is this error?')).toBeInTheDocument();
      expect(screen.getByText('This is a null pointer exception.')).toBeInTheDocument();
      expect(
        screen.queryByText('Ask Seer anything about your application.')
      ).not.toBeInTheDocument();
    });
  });

  describe('Input Handling', () => {
    it('can type in the textarea', async () => {
      render(
        <PictureInPictureProvider>
          <SeerExplorerSessionsProvider>
            <SeerExplorerContent
              getPageReferrer={mockGetPageReferrer}
              onClose={() => {}}
            />
          </SeerExplorerSessionsProvider>
        </PictureInPictureProvider>,
        {
          organization,
        }
      );
      const textarea = await screen.findByTestId('seer-explorer-input');
      await userEvent.type(textarea, 'Test message');
      expect(textarea).toHaveValue('Test message');
    });

    it('calls sendMessage and clears input when send button is clicked', async () => {
      const sendMessage = jest.fn();
      jest.spyOn(useSeerExplorerModule, 'useSeerExplorer').mockReturnValue({
        ...defaultHookReturn,
        sendMessage,
      });

      render(
        <PictureInPictureProvider>
          <SeerExplorerSessionsProvider>
            <SeerExplorerContent
              getPageReferrer={mockGetPageReferrer}
              onClose={() => {}}
            />
          </SeerExplorerSessionsProvider>
        </PictureInPictureProvider>,
        {
          organization,
        }
      );

      const textarea = await screen.findByTestId('seer-explorer-input');
      await userEvent.type(textarea, 'Test message');
      await userEvent.click(screen.getByRole('button', {name: 'Send message'}));

      expect(sendMessage).toHaveBeenCalledWith('Test message', 0);
      expect(textarea).toHaveValue('');
    });

    it('calls sendMessage and clears input when Enter is pressed', async () => {
      const sendMessage = jest.fn();
      jest.spyOn(useSeerExplorerModule, 'useSeerExplorer').mockReturnValue({
        ...defaultHookReturn,
        sendMessage,
      });

      render(
        <PictureInPictureProvider>
          <SeerExplorerSessionsProvider>
            <SeerExplorerContent
              getPageReferrer={mockGetPageReferrer}
              onClose={() => {}}
            />
          </SeerExplorerSessionsProvider>
        </PictureInPictureProvider>,
        {
          organization,
        }
      );

      const textarea = await screen.findByTestId('seer-explorer-input');
      await userEvent.type(textarea, 'Test message');
      await userEvent.keyboard('{Enter}');

      expect(sendMessage).toHaveBeenCalledWith('Test message', 0);
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

      render(
        <PictureInPictureProvider>
          <SeerExplorerSessionsProvider>
            <SeerExplorerContent
              getPageReferrer={mockGetPageReferrer}
              onClose={() => {}}
            />
          </SeerExplorerSessionsProvider>
        </PictureInPictureProvider>,
        {
          organization,
        }
      );

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

      render(
        <PictureInPictureProvider>
          <SeerExplorerSessionsProvider>
            <SeerExplorerContent
              getPageReferrer={mockGetPageReferrer}
              onClose={() => {}}
            />
          </SeerExplorerSessionsProvider>
        </PictureInPictureProvider>,
        {
          organization,
        }
      );

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

      render(
        <PictureInPictureProvider>
          <SeerExplorerSessionsProvider>
            <SeerExplorerContent
              getPageReferrer={mockGetPageReferrer}
              onClose={() => {}}
            />
          </SeerExplorerSessionsProvider>
        </PictureInPictureProvider>,
        {
          organization,
        }
      );

      const textarea = await screen.findByTestId('seer-explorer-input');
      await userEvent.type(textarea, 'Test message');
      await userEvent.keyboard('{Enter}');

      expect(sendMessage).not.toHaveBeenCalled();
    });

    it('sends message with correct index when session has existing blocks', async () => {
      const sendMessage = jest.fn();
      jest.spyOn(useSeerExplorerModule, 'useSeerExplorer').mockReturnValue({
        ...defaultHookReturn,
        sendMessage,
        sessionData: {
          blocks: [
            {
              id: 'msg-1',
              message: {role: 'user', content: 'First message'},
              timestamp: '2024-01-01T00:00:00Z',
              loading: false,
            },
            {
              id: 'msg-2',
              message: {role: 'assistant', content: 'First response'},
              timestamp: '2024-01-01T00:01:00Z',
              loading: false,
            },
            {
              id: 'msg-3',
              message: {role: 'user', content: 'Second message'},
              timestamp: '2024-01-01T00:02:00Z',
              loading: false,
            },
          ],
          run_id: 123,
          status: 'completed',
          updated_at: '2024-01-01T00:02:00Z',
        } as SeerExplorerResponse['session'],
      });

      render(
        <PictureInPictureProvider>
          <SeerExplorerSessionsProvider>
            <SeerExplorerContent
              getPageReferrer={mockGetPageReferrer}
              onClose={() => {}}
            />
          </SeerExplorerSessionsProvider>
        </PictureInPictureProvider>,
        {
          organization,
        }
      );

      const textarea = await screen.findByTestId('seer-explorer-input');
      await userEvent.type(textarea, 'New message');
      await userEvent.keyboard('{Enter}');

      expect(sendMessage).toHaveBeenCalledWith('New message', 3);
    });
  });

  describe('Input Persistence', () => {
    it('restores the persisted draft when the drawer remounts', async () => {
      jest.spyOn(useSeerExplorerModule, 'useSeerExplorer').mockReturnValue({
        ...defaultHookReturn,
        runId: 7,
      });

      const {unmount} = render(
        <PictureInPictureProvider>
          <SeerExplorerSessionsProvider>
            <SeerExplorerContent
              getPageReferrer={mockGetPageReferrer}
              onClose={() => {}}
            />
          </SeerExplorerSessionsProvider>
        </PictureInPictureProvider>,
        {organization}
      );

      await userEvent.type(
        await screen.findByTestId('seer-explorer-input'),
        'draft message'
      );
      unmount();

      render(
        <PictureInPictureProvider>
          <SeerExplorerSessionsProvider>
            <SeerExplorerContent
              getPageReferrer={mockGetPageReferrer}
              onClose={() => {}}
            />
          </SeerExplorerSessionsProvider>
        </PictureInPictureProvider>,
        {organization}
      );

      expect(await screen.findByTestId('seer-explorer-input')).toHaveValue(
        'draft message'
      );
    });

    it('persists the draft per runId across run switches', async () => {
      const useSeerExplorerSpy = jest.spyOn(useSeerExplorerModule, 'useSeerExplorer');
      useSeerExplorerSpy.mockReturnValue({...defaultHookReturn, runId: 1});

      const {rerender} = render(
        <PictureInPictureProvider>
          <SeerExplorerSessionsProvider>
            <SeerExplorerContent
              getPageReferrer={mockGetPageReferrer}
              onClose={() => {}}
            />
          </SeerExplorerSessionsProvider>
        </PictureInPictureProvider>,
        {organization}
      );

      await userEvent.type(
        await screen.findByTestId('seer-explorer-input'),
        'draft for run 1'
      );

      useSeerExplorerSpy.mockReturnValue({...defaultHookReturn, runId: 2});
      rerender(
        <PictureInPictureProvider>
          <SeerExplorerSessionsProvider>
            <SeerExplorerContent
              getPageReferrer={mockGetPageReferrer}
              onClose={() => {}}
            />
          </SeerExplorerSessionsProvider>
        </PictureInPictureProvider>
      );

      await waitFor(() =>
        expect(screen.getByTestId('seer-explorer-input')).toHaveValue('')
      );
      expect(
        JSON.parse(sessionStorage.getItem(`${INPUT_STORAGE_KEY_PREFIX}:1`) ?? '')
      ).toBe('draft for run 1');

      useSeerExplorerSpy.mockReturnValue({...defaultHookReturn, runId: 1});
      rerender(
        <PictureInPictureProvider>
          <SeerExplorerSessionsProvider>
            <SeerExplorerContent
              getPageReferrer={mockGetPageReferrer}
              onClose={() => {}}
            />
          </SeerExplorerSessionsProvider>
        </PictureInPictureProvider>
      );

      await waitFor(() =>
        expect(screen.getByTestId('seer-explorer-input')).toHaveValue('draft for run 1')
      );
    });

    it('never writes to sessionStorage when runId is null (no session)', async () => {
      const setItemSpy = jest.spyOn(Storage.prototype, 'setItem');

      const {unmount} = render(
        <PictureInPictureProvider>
          <SeerExplorerSessionsProvider>
            <SeerExplorerContent
              getPageReferrer={mockGetPageReferrer}
              onClose={() => {}}
            />
          </SeerExplorerSessionsProvider>
        </PictureInPictureProvider>,
        {organization}
      );

      await userEvent.type(
        await screen.findByTestId('seer-explorer-input'),
        'unsaved draft'
      );
      unmount();

      const draftWrites = setItemSpy.mock.calls.filter(([k]) =>
        String(k).startsWith(`${INPUT_STORAGE_KEY_PREFIX}:`)
      );
      expect(draftWrites).toHaveLength(0);
    });

    it('clears the persisted draft when a message is sent', async () => {
      const sendMessage = jest.fn();
      jest.spyOn(useSeerExplorerModule, 'useSeerExplorer').mockReturnValue({
        ...defaultHookReturn,
        sendMessage,
        runId: 42,
      });

      render(
        <PictureInPictureProvider>
          <SeerExplorerSessionsProvider>
            <SeerExplorerContent
              getPageReferrer={mockGetPageReferrer}
              onClose={() => {}}
            />
          </SeerExplorerSessionsProvider>
        </PictureInPictureProvider>,
        {organization}
      );

      const textarea = await screen.findByTestId('seer-explorer-input');
      await userEvent.type(textarea, 'hello');
      await userEvent.keyboard('{Enter}');

      expect(sendMessage).toHaveBeenCalledWith('hello', 0);
      expect(textarea).toHaveValue('');
      expect(sessionStorage.getItem(`${INPUT_STORAGE_KEY_PREFIX}:42`)).toBeNull();
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
        } as SeerExplorerResponse['session'],
      });

      render(
        <PictureInPictureProvider>
          <SeerExplorerSessionsProvider>
            <SeerExplorerContent
              getPageReferrer={mockGetPageReferrer}
              onClose={() => {}}
            />
          </SeerExplorerSessionsProvider>
        </PictureInPictureProvider>,
        {
          organization,
        }
      );

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
        } as SeerExplorerResponse['session'],
      });

      render(
        <PictureInPictureProvider>
          <SeerExplorerSessionsProvider>
            <SeerExplorerContent
              getPageReferrer={mockGetPageReferrer}
              onClose={() => {}}
            />
          </SeerExplorerSessionsProvider>
        </PictureInPictureProvider>,
        {
          organization,
        }
      );

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
        } as SeerExplorerResponse['session'],
      });

      render(
        <PictureInPictureProvider>
          <SeerExplorerSessionsProvider>
            <SeerExplorerContent
              getPageReferrer={mockGetPageReferrer}
              onClose={() => {}}
            />
          </SeerExplorerSessionsProvider>
        </PictureInPictureProvider>,
        {
          organization,
        }
      );

      const textarea = await screen.findByTestId('seer-explorer-input');
      await waitFor(() => expect(textarea).toBeEnabled());
    });
  });

  describe('Context Engine Toggle', () => {
    const orgWithFlag = OrganizationFixture({
      openMembership: true,
      hideAiFeatures: false,
      features: [
        'seer-explorer',
        'gen-ai-features',
        'seer-explorer-context-engine-fe-override-ui-flag',
      ],
    });

    it('does not show the debug menu without any debug feature flag', async () => {
      render(
        <PictureInPictureProvider>
          <SeerExplorerSessionsProvider>
            <SeerExplorerContent
              getPageReferrer={mockGetPageReferrer}
              onClose={() => {}}
            />
          </SeerExplorerSessionsProvider>
        </PictureInPictureProvider>,
        {
          organization,
        }
      );
      await screen.findByTestId('seer-explorer-input');
      expect(screen.queryByRole('button', {name: 'Debug'})).not.toBeInTheDocument();
    });

    it('shows the context engine toggle in the debug menu when the flag is enabled', async () => {
      render(
        <PictureInPictureProvider>
          <SeerExplorerSessionsProvider>
            <SeerExplorerContent
              getPageReferrer={mockGetPageReferrer}
              onClose={() => {}}
            />
          </SeerExplorerSessionsProvider>
        </PictureInPictureProvider>,
        {
          organization: orgWithFlag,
        }
      );

      await userEvent.click(await screen.findByRole('button', {name: 'Debug'}));
      expect(
        screen.getByRole('menuitemradio', {name: /Context Engine/})
      ).toBeInTheDocument();
    });
  });

  describe('Picture-in-Picture', () => {
    afterEach(() => {
      // @ts-expect-error - cleaning up the stub
      delete window.documentPictureInPicture;
    });

    it('does not show the pop-out button when PiP is unsupported', async () => {
      render(
        <PictureInPictureProvider>
          <SeerExplorerSessionsProvider>
            <SeerExplorerContent
              getPageReferrer={mockGetPageReferrer}
              onClose={() => {}}
            />
          </SeerExplorerSessionsProvider>
        </PictureInPictureProvider>,
        {organization}
      );
      await screen.findByTestId('seer-explorer-input');
      expect(
        screen.queryByRole('button', {name: 'Open in a separate window'})
      ).not.toBeInTheDocument();
    });

    it('shows the pop-out button and requests a window on click', async () => {
      const requestWindow = jest.fn().mockResolvedValue({
        document: document.implementation.createHTMLDocument('pip'),
        close: jest.fn(),
        focus: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        closed: false,
      });
      Object.defineProperty(window, 'documentPictureInPicture', {
        configurable: true,
        writable: true,
        value: {requestWindow, window: null},
      });

      render(
        <PictureInPictureProvider>
          <SeerExplorerSessionsProvider>
            <SeerExplorerContent
              getPageReferrer={mockGetPageReferrer}
              onClose={() => {}}
            />
          </SeerExplorerSessionsProvider>
        </PictureInPictureProvider>,
        {organization}
      );

      const button = await screen.findByRole('button', {
        name: 'Open in a separate window',
      });
      await userEvent.click(button);
      await waitFor(() => expect(requestWindow).toHaveBeenCalled());
    });

    it('requests a window when selecting Windowed from the dock-position menu', async () => {
      const requestWindow = jest.fn().mockResolvedValue({
        document: document.implementation.createHTMLDocument('pip'),
        close: jest.fn(),
        focus: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        closed: false,
      });
      Object.defineProperty(window, 'documentPictureInPicture', {
        configurable: true,
        writable: true,
        value: {requestWindow, window: null},
      });

      render(
        <PictureInPictureProvider>
          <SeerExplorerSessionsProvider>
            <SeerExplorerContent
              getPageReferrer={mockGetPageReferrer}
              onClose={() => {}}
              sidebarPosition="auto"
              onSidebarPositionChange={() => {}}
            />
          </SeerExplorerSessionsProvider>
        </PictureInPictureProvider>,
        {organization}
      );

      const input = await screen.findByTestId('seer-explorer-input');

      // The content auto-focuses the textarea ~100ms after opening. Wait for that
      // to settle first — otherwise it steals focus from (and closes) the dock
      // menu mid-interaction, dropping the `Windowed` item.
      await waitFor(() => expect(input).toHaveFocus());

      await userEvent.click(screen.getByRole('button', {name: 'Dock position'}));
      await userEvent.click(await screen.findByRole('menuitemradio', {name: 'Windowed'}));
      await waitFor(() => expect(requestWindow).toHaveBeenCalled());
    });
  });
});
