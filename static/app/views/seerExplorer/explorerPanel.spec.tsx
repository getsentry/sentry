import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import * as useSeerExplorerModule from './hooks/useSeerExplorer';
import ExplorerPanel from './explorerPanel';

// Mock createPortal to render content directly
jest.mock('react-dom', () => ({
  ...jest.requireActual('react-dom'),
  createPortal: (node: React.ReactNode) => node,
}));

describe('ExplorerPanel', () => {
  const organization = OrganizationFixture({
    features: ['seer-explorer'],
    hideAiFeatures: false,
  });

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    sessionStorage.clear();

    // This matches the real behavior when no run ID is provided.
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/explorer-chat/`,
      method: 'GET',
      body: {session: null},
      statusCode: 404,
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/explorer-runs/`,
      method: 'GET',
      body: {
        data: [
          {
            run_id: 456,
            title: 'Old Run',
            created_at: '2024-01-02T00:00:00Z',
            last_triggered_at: '2024-01-03T00:00:00Z',
          },
          {
            run_id: 451,
            title: 'Another Run',
            created_at: '2024-01-01T00:00:00Z',
            last_triggered_at: '2024-01-01T17:53:33Z',
          },
        ],
      },
    });
  });

  describe('Feature Flag and Organization Checks', () => {
    it('renders when feature flag is enabled', () => {
      render(<ExplorerPanel isVisible />, {organization});

      expect(
        screen.getByText(/Ask Seer anything about your application./)
      ).toBeInTheDocument();
    });

    it('does not render when feature flag is disabled', () => {
      const disabledOrg = OrganizationFixture({
        features: [],
      });

      const {container} = render(<ExplorerPanel isVisible />, {
        organization: disabledOrg,
      });

      expect(container).toBeEmptyDOMElement();
    });

    it('does not render when AI features are hidden', () => {
      const disabledOrg = OrganizationFixture({
        features: ['seer-explorer'],
        hideAiFeatures: true,
      });

      const {container} = render(<ExplorerPanel isVisible />, {
        organization: disabledOrg,
      });

      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no messages exist', () => {
      render(<ExplorerPanel isVisible />, {organization});

      expect(
        screen.getByText(/Ask Seer anything about your application./)
      ).toBeInTheDocument();
    });

    it('shows input section in empty state', () => {
      render(<ExplorerPanel isVisible />, {organization});

      expect(
        screen.getByPlaceholderText('Type your message or / command and press Enter ↵')
      ).toBeInTheDocument();
    });
  });

  describe('Messages Display', () => {
    it('renders messages when session data exists', () => {
      const mockSessionData = {
        blocks: [
          {
            id: 'msg-1',
            message: {
              role: 'user',
              content: 'What is this error?',
            },
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
        run_id: 123,
        status: 'completed' as const,
        updated_at: '2024-01-01T00:01:00Z',
      };

      // Mock the hook to return our test data
      jest.spyOn(useSeerExplorerModule, 'useSeerExplorer').mockReturnValue({
        sessionData:
          mockSessionData as useSeerExplorerModule.SeerExplorerResponse['session'],
        sendMessage: jest.fn(),
        deleteFromIndex: jest.fn(),
        startNewSession: jest.fn(),
        isPolling: false,
        isPending: false,
        deletedFromIndex: null,
        interruptRun: jest.fn(),
        interruptRequested: false,
        runId: null,
        setRunId: jest.fn(),
        respondToUserInput: jest.fn(),
        switchToRun: jest.fn(),
        createPR: jest.fn(),
      });

      render(<ExplorerPanel isVisible />, {organization});

      expect(screen.getByText('What is this error?')).toBeInTheDocument();
      expect(
        screen.getByText('This error indicates a null pointer exception.')
      ).toBeInTheDocument();
      expect(
        screen.queryByText(/Ask Seer anything about your application./)
      ).not.toBeInTheDocument();

      // Restore the mock
      jest.restoreAllMocks();
    });
  });

  describe('Input Handling', () => {
    it('can type in textarea', async () => {
      render(<ExplorerPanel isVisible />, {organization});

      const textarea = screen.getByTestId('seer-explorer-input');
      await userEvent.type(textarea, 'Test message');

      expect(textarea).toHaveValue('Test message');
    });

    it('sends message when Enter is pressed', async () => {
      const postMock = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/seer/explorer-chat/`,
        method: 'POST',
        body: {
          run_id: 'new-run',
          message: {
            id: 'response-1',
            type: 'response',
            content: 'Response content',
            timestamp: '2024-01-01T00:01:00Z',
            loading: false,
          },
        },
      });

      // Mock the GET request that happens after POST to fetch session state
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/seer/explorer-chat/new-run/`,
        method: 'GET',
        body: {
          session: {
            blocks: [
              {
                id: 'msg-1',
                message: {
                  role: 'user',
                  content: 'What is this error?',
                },
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
            run_id: 'new-run',
            status: 'completed',
            updated_at: '2024-01-01T00:01:00Z',
          },
        },
      });

      render(<ExplorerPanel isVisible />, {organization});

      const textarea = screen.getByTestId('seer-explorer-input');
      await userEvent.type(textarea, 'Test message');
      await userEvent.keyboard('{Enter}');

      expect(postMock).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/seer/explorer-chat/`,
        expect.objectContaining({
          method: 'POST',
          data: expect.objectContaining({
            query: 'Test message',
          }),
        })
      );
    });

    it('clears input after sending message', async () => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/seer/explorer-chat/`,
        method: 'POST',
        body: {
          run_id: 'new-run',
          message: {
            id: 'response-1',
            type: 'response',
            content: 'Response',
            timestamp: '2024-01-01T00:01:00Z',
            loading: false,
          },
        },
      });

      // Mock the GET request that happens after POST to fetch session state
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/seer/explorer-chat/new-run/`,
        method: 'GET',
        body: {
          session: {
            blocks: [
              {
                id: 'msg-1',
                message: {
                  role: 'user',
                  content: 'What is this error?',
                },
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
            run_id: 'new-run',
            status: 'completed',
            updated_at: '2024-01-01T00:01:00Z',
          },
        },
      });

      render(<ExplorerPanel isVisible />, {organization});

      const textarea = screen.getByTestId('seer-explorer-input');
      await userEvent.type(textarea, 'Test message');
      await userEvent.keyboard('{Enter}');

      expect(textarea).toHaveValue('');
    });
  });

  describe('Visibility Control', () => {
    it('renders when isVisible=true', () => {
      render(<ExplorerPanel isVisible />, {organization});

      expect(screen.getByTestId('seer-explorer-input')).toBeInTheDocument();
    });

    it('can handle visibility changes', () => {
      const {rerender} = render(<ExplorerPanel isVisible={false} />, {organization});

      rerender(<ExplorerPanel isVisible />);

      expect(screen.getByTestId('seer-explorer-input')).toBeInTheDocument();
    });
  });
});
