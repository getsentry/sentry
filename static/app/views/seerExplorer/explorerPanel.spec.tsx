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
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  describe('Feature Flag and Organization Checks', () => {
    it('renders when feature flag is enabled', () => {
      const organization = OrganizationFixture({
        features: ['seer-explorer'],
        hideAiFeatures: false,
      });

      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/seer/explorer-chat/`,
        method: 'GET',
        body: {session: null},
      });

      render(<ExplorerPanel isVisible />, {organization});

      expect(screen.getByText(/Welcome to Seer Explorer/)).toBeInTheDocument();
    });

    it('does not render when feature flag is disabled', () => {
      const organization = OrganizationFixture({
        features: [],
      });

      const {container} = render(<ExplorerPanel isVisible />, {organization});

      expect(container).toBeEmptyDOMElement();
    });

    it('does not render when AI features are hidden', () => {
      const organization = OrganizationFixture({
        features: ['seer-explorer'],
        hideAiFeatures: true,
      });

      const {container} = render(<ExplorerPanel isVisible />, {organization});

      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no messages exist', () => {
      const organization = OrganizationFixture({
        features: ['seer-explorer'],
      });

      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/seer/explorer-chat/`,
        method: 'GET',
        body: {session: null},
      });

      render(<ExplorerPanel isVisible />, {organization});

      expect(screen.getByText(/Welcome to Seer Explorer/)).toBeInTheDocument();
    });

    it('shows input section in empty state', () => {
      const organization = OrganizationFixture({
        features: ['seer-explorer'],
      });

      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/seer/explorer-chat/`,
        method: 'GET',
        body: {session: null},
      });

      render(<ExplorerPanel isVisible />, {organization});

      expect(
        screen.getByPlaceholderText('Type your message or / command and press Enter ↵')
      ).toBeInTheDocument();
    });
  });

  describe('Messages Display', () => {
    it('renders messages when session data exists', () => {
      const organization = OrganizationFixture({
        features: ['seer-explorer'],
      });

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
        runId: 123,
        deletedFromIndex: null,
      });

      render(<ExplorerPanel isVisible />, {organization});

      expect(screen.getByText('What is this error?')).toBeInTheDocument();
      expect(
        screen.getByText('This error indicates a null pointer exception.')
      ).toBeInTheDocument();
      expect(screen.queryByText(/Welcome to Seer Explorer/)).not.toBeInTheDocument();

      // Restore the mock
      jest.restoreAllMocks();
    });
  });

  describe('Input Handling', () => {
    it('can type in textarea', async () => {
      const organization = OrganizationFixture({
        features: ['seer-explorer'],
      });

      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/seer/explorer-chat/`,
        method: 'GET',
        body: {session: null},
      });

      render(<ExplorerPanel isVisible />, {organization});

      const textarea = screen.getByRole('textbox');
      await userEvent.type(textarea, 'Test message');

      expect(textarea).toHaveValue('Test message');
    });

    it('sends message when Enter is pressed', async () => {
      const organization = OrganizationFixture({
        features: ['seer-explorer'],
      });

      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/seer/explorer-chat/`,
        method: 'GET',
        body: {session: null},
      });

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
            messages: [
              {
                id: 'msg-1',
                type: 'user-input',
                content: 'Test message',
                timestamp: '2024-01-01T00:00:00Z',
                loading: false,
              },
              {
                id: 'response-1',
                type: 'response',
                content: 'Response content',
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

      const textarea = screen.getByRole('textbox');
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
      const organization = OrganizationFixture({
        features: ['seer-explorer'],
      });

      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/seer/explorer-chat/`,
        method: 'GET',
        body: {session: null},
      });

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
            messages: [
              {
                id: 'msg-1',
                type: 'user-input',
                content: 'Test message',
                timestamp: '2024-01-01T00:00:00Z',
                loading: false,
              },
              {
                id: 'response-1',
                type: 'response',
                content: 'Response',
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

      const textarea = screen.getByRole('textbox');
      await userEvent.type(textarea, 'Test message');
      await userEvent.keyboard('{Enter}');

      expect(textarea).toHaveValue('');
    });
  });

  describe('Visibility Control', () => {
    it('renders when isVisible=true', () => {
      const organization = OrganizationFixture({
        features: ['seer-explorer'],
      });

      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/seer/explorer-chat/`,
        method: 'GET',
        body: {session: null},
      });

      render(<ExplorerPanel isVisible />, {organization});

      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('can handle visibility changes', () => {
      const organization = OrganizationFixture({
        features: ['seer-explorer'],
      });

      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/seer/explorer-chat/`,
        method: 'GET',
        body: {session: null},
      });

      const {rerender} = render(<ExplorerPanel isVisible={false} />, {organization});

      rerender(<ExplorerPanel isVisible />);

      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });
  });
});
