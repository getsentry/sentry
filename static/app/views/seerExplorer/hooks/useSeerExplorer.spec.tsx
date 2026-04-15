import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {usePageReferrer} from 'sentry/views/seerExplorer/utils';

import {useSeerExplorer} from './useSeerExplorer';

jest.mock('sentry/views/seerExplorer/utils', () => ({
  ...jest.requireActual('sentry/views/seerExplorer/utils'),
  usePageReferrer: jest.fn(),
}));

// Controlled mock for useTimeout — lets tests trigger the timeout callback directly
// instead of relying on real or fake timers (which conflict with router initialization).
const mockTimeoutStart = jest.fn();
const mockTimeoutCancel = jest.fn();
let capturedOnTimeout: (() => void) | null = null;

jest.mock('sentry/utils/useTimeout', () => ({
  useTimeout: ({onTimeout}: {onTimeout: () => void; timeMs: number}) => {
    capturedOnTimeout = onTimeout;
    return {start: mockTimeoutStart, cancel: mockTimeoutCancel, end: jest.fn()};
  },
}));

describe('useSeerExplorer', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    sessionStorage.clear();
    (usePageReferrer as jest.Mock).mockReturnValue({
      getPageReferrer: () => '/issues/',
    });
  });

  const organization = OrganizationFixture({
    features: ['seer-explorer'],
    hideAiFeatures: false,
  });

  describe('Initial State', () => {
    it('returns initial state with no session data', () => {
      const {result} = renderHookWithProviders(() => useSeerExplorer(), {
        organization,
      });

      expect(result.current.sessionData).toBeNull();
      expect(result.current.isPolling).toBe(false);
      expect(result.current.runId).toBeNull();
      expect(result.current.deletedFromIndex).toBeNull();
    });
  });

  describe('sendMessage', () => {
    it('sends message with correct payload for new session', async () => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/seer/explorer-chat/`,
        method: 'GET',
        body: {session: null},
      });

      const postMock = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/seer/explorer-chat/`,
        method: 'POST',
        body: {
          run_id: 123,
          message: {
            id: 'msg-1',
            message: {
              role: 'assistant',
              content: 'Response content',
            },
            timestamp: '2024-01-01T00:00:00Z',
            loading: false,
          },
        },
      });

      // Mock the GET request that happens after POST to fetch session state
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/seer/explorer-chat/123/`,
        method: 'GET',
        body: {
          session: {
            blocks: [
              {
                id: 'msg-1',
                message: {
                  role: 'assistant',
                  content: 'Response content',
                },
                timestamp: '2024-01-01T00:00:00Z',
                loading: false,
              },
            ],
            run_id: 123,
            status: 'completed',
            updated_at: '2024-01-01T00:00:00Z',
          },
        },
      });

      const {result} = renderHookWithProviders(() => useSeerExplorer(), {
        organization,
      });

      await act(async () => {
        await result.current.sendMessage('Test query');
      });

      expect(postMock).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/seer/explorer-chat/`,
        expect.objectContaining({
          method: 'POST',
          data: expect.objectContaining({
            query: 'Test query',
            insert_index: 0,
          }),
        })
      );
    });

    it('sends structured JSON on dashboard page with feature flag', async () => {
      (usePageReferrer as jest.Mock).mockReturnValue({
        getPageReferrer: () => '/dashboard/:dashboardId/',
      });
      const org = OrganizationFixture({
        features: ['seer-explorer', 'context-engine-structured-page-context'],
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${org.slug}/seer/explorer-chat/`,
        method: 'GET',
        body: {session: null},
      });
      const postMock = MockApiClient.addMockResponse({
        url: `/organizations/${org.slug}/seer/explorer-chat/`,
        method: 'POST',
        body: {run_id: 1},
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${org.slug}/seer/explorer-chat/1/`,
        method: 'GET',
        body: {session: {blocks: [], run_id: 1, status: 'completed', updated_at: ''}},
      });

      const {result} = renderHookWithProviders(() => useSeerExplorer(), {
        organization: org,
      });
      await act(async () => {
        await result.current.sendMessage('q');
      });

      const ctx = postMock.mock.calls[0][1].data.on_page_context;
      expect(JSON.parse(ctx)).toHaveProperty('nodes');
    });

    it('falls back to ASCII screenshot on non-dashboard page', async () => {
      const org = OrganizationFixture({
        features: ['seer-explorer', 'context-engine-structured-page-context'],
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${org.slug}/seer/explorer-chat/`,
        method: 'GET',
        body: {session: null},
      });
      const postMock = MockApiClient.addMockResponse({
        url: `/organizations/${org.slug}/seer/explorer-chat/`,
        method: 'POST',
        body: {run_id: 1},
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${org.slug}/seer/explorer-chat/1/`,
        method: 'GET',
        body: {session: {blocks: [], run_id: 1, status: 'completed', updated_at: ''}},
      });

      const {result} = renderHookWithProviders(() => useSeerExplorer(), {
        organization: org,
      });
      await act(async () => {
        await result.current.sendMessage('q');
      });

      // usePageReferrer returns '/issues/' by default (from beforeEach) — not in STRUCTURED_CONTEXT_ROUTES
      const ctx = postMock.mock.calls[0][1].data.on_page_context;
      expect(() => JSON.parse(ctx)).toThrow();
    });

    it('handles API errors gracefully', async () => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/seer/explorer-chat/`,
        method: 'GET',
        body: {session: null},
      });

      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/seer/explorer-chat/`,
        method: 'POST',
        statusCode: 500,
        body: {detail: 'Server error'},
      });

      const {result} = renderHookWithProviders(() => useSeerExplorer(), {
        organization,
      });

      // Should handle error without throwing
      await act(async () => {
        await expect(result.current.sendMessage('Test query')).resolves.not.toThrow();
      });
    });
  });

  describe('startNewSession', () => {
    it('resets session state', () => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/seer/explorer-chat/`,
        method: 'GET',
        body: {session: null},
      });

      const {result} = renderHookWithProviders(() => useSeerExplorer(), {
        organization,
      });

      act(() => {
        result.current.startNewSession();
      });

      expect(result.current.runId).toBeNull();
      expect(result.current.deletedFromIndex).toBeNull();
    });
  });

  describe('deleteFromIndex', () => {
    it('sets deleted from index', () => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/seer/explorer-chat/`,
        method: 'GET',
        body: {session: null},
      });

      const {result} = renderHookWithProviders(() => useSeerExplorer(), {
        organization,
      });

      act(() => {
        result.current.deleteFromIndex(2);
      });

      expect(result.current.deletedFromIndex).toBe(2);
    });

    it('filters messages based on deleted index', () => {
      const {result} = renderHookWithProviders(() => useSeerExplorer(), {
        organization,
      });

      act(() => {
        result.current.deleteFromIndex(1);
      });

      expect(result.current.deletedFromIndex).toBe(1);
    });
  });

  describe('Polling Logic', () => {
    it('returns false for polling when no session exists', () => {
      const {result} = renderHookWithProviders(() => useSeerExplorer(), {
        organization,
      });

      expect(result.current.isPolling).toBe(false);
    });
  });

  describe('Optimistic Thinking Block', () => {
    it('persists thinking block when server has no assistant response yet', async () => {
      const chatUrl = `/organizations/${organization.slug}/seer/explorer-chat/`;

      MockApiClient.addMockResponse({url: chatUrl, method: 'GET', body: {session: null}});
      MockApiClient.addMockResponse({url: chatUrl, method: 'POST', body: {run_id: 456}});
      MockApiClient.addMockResponse({
        url: `${chatUrl}456/`,
        method: 'GET',
        body: {
          session: {
            blocks: [
              {
                id: 'user-1',
                message: {role: 'user', content: 'Test'},
                timestamp: '2024-01-01T00:00:00Z',
                loading: false,
              },
            ],
            run_id: 456,
            status: 'processing',
            updated_at: '2024-01-01T00:00:00Z',
          },
        },
      });

      const {result} = renderHookWithProviders(() => useSeerExplorer(), {organization});

      await act(async () => {
        await result.current.sendMessage('Test');
      });

      await waitFor(() => (result.current.sessionData?.blocks ?? []).length > 0);

      const blocks = result.current.sessionData?.blocks ?? [];
      expect(blocks.some(b => b.message.role === 'assistant' && b.loading)).toBe(true);
    });

    it('keeps optimistic state when rethinking with the same message', async () => {
      const chatUrl = `/organizations/${organization.slug}/seer/explorer-chat/`;
      const ts = '2024-01-01T00:00:00Z';

      MockApiClient.addMockResponse({url: chatUrl, method: 'GET', body: {session: null}});
      MockApiClient.addMockResponse({
        url: `${chatUrl}789/`,
        method: 'GET',
        body: {
          session: {
            blocks: [
              {
                id: 'u0',
                message: {role: 'user', content: 'hello'},
                timestamp: ts,
                loading: false,
              },
              {
                id: 'a1',
                message: {role: 'assistant', content: 'Hi!'},
                timestamp: ts,
                loading: false,
              },
            ],
            run_id: 789,
            status: 'completed',
            updated_at: ts,
          },
        },
      });
      MockApiClient.addMockResponse({
        url: `${chatUrl}789/`,
        method: 'POST',
        body: {run_id: 789},
      });

      const {result} = renderHookWithProviders(() => useSeerExplorer(), {organization});

      act(() => result.current.switchToRun(789));
      await waitFor(() => result.current.sessionData?.blocks?.length === 2);

      act(() => result.current.deleteFromIndex(0));
      await act(async () => {
        await result.current.sendMessage('hello');
      });

      expect(result.current.sessionData?.blocks?.some(b => b.loading)).toBe(true);
      expect(result.current.deletedFromIndex).toBe(0);
    });
  });

  describe('Timeout', () => {
    beforeEach(() => {
      mockTimeoutStart.mockClear();
      mockTimeoutCancel.mockClear();
      capturedOnTimeout = null;
    });

    it('isTimedOut is false by default', () => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/seer/explorer-chat/`,
        method: 'GET',
        body: {session: null},
      });

      const {result} = renderHookWithProviders(() => useSeerExplorer(), {organization});

      expect(result.current.isTimedOut).toBe(false);
    });

    it('isTimedOut becomes true when the timeout fires during a request', async () => {
      const chatUrl = `/organizations/${organization.slug}/seer/explorer-chat/`;

      MockApiClient.addMockResponse({url: chatUrl, method: 'GET', body: {session: null}});
      MockApiClient.addMockResponse({url: chatUrl, method: 'POST', body: {run_id: 1}});
      MockApiClient.addMockResponse({
        url: `${chatUrl}1/`,
        method: 'GET',
        body: {
          session: {
            blocks: [],
            run_id: 1,
            status: 'processing',
            updated_at: '2024-01-01T00:00:00Z',
          },
        },
      });

      const {result} = renderHookWithProviders(() => useSeerExplorer(), {organization});

      await act(async () => {
        await result.current.sendMessage('Test');
      });

      // Simulate the 7-minute timeout firing
      act(() => {
        capturedOnTimeout?.();
      });

      expect(result.current.isTimedOut).toBe(true);
      expect(result.current.isPolling).toBe(false);
    });

    it('isTimedOut resets to false when a new message is sent after timeout', async () => {
      const chatUrl = `/organizations/${organization.slug}/seer/explorer-chat/`;

      MockApiClient.addMockResponse({url: chatUrl, method: 'GET', body: {session: null}});
      MockApiClient.addMockResponse({url: chatUrl, method: 'POST', body: {run_id: 1}});
      MockApiClient.addMockResponse({
        url: `${chatUrl}1/`,
        method: 'GET',
        body: {
          session: {
            blocks: [],
            run_id: 1,
            status: 'processing',
            updated_at: '2024-01-01T00:00:00Z',
          },
        },
      });

      const {result} = renderHookWithProviders(() => useSeerExplorer(), {organization});

      await act(async () => {
        await result.current.sendMessage('First message');
      });
      act(() => {
        capturedOnTimeout?.();
      });
      expect(result.current.isTimedOut).toBe(true);

      // Send a new message — isTimedOut should reset.
      // After the first send, runId is set to 1, so subsequent sends POST to the run-scoped URL.
      MockApiClient.addMockResponse({
        url: `${chatUrl}1/`,
        method: 'POST',
        body: {run_id: 1},
      });
      MockApiClient.addMockResponse({
        url: `${chatUrl}1/`,
        method: 'GET',
        body: {
          session: {
            blocks: [],
            run_id: 1,
            status: 'processing',
            updated_at: '2024-01-01T00:01:00Z',
          },
        },
      });

      await act(async () => {
        await result.current.sendMessage('Second message');
      });

      expect(result.current.isTimedOut).toBe(false);
    });

    it('timeout timer is cancelled when the response loads successfully', async () => {
      const chatUrl = `/organizations/${organization.slug}/seer/explorer-chat/`;

      MockApiClient.addMockResponse({url: chatUrl, method: 'GET', body: {session: null}});
      MockApiClient.addMockResponse({url: chatUrl, method: 'POST', body: {run_id: 1}});
      MockApiClient.addMockResponse({
        url: `${chatUrl}1/`,
        method: 'GET',
        body: {
          session: {
            blocks: [
              {
                id: 'a1',
                message: {role: 'assistant', content: 'Done'},
                timestamp: '2024-01-01T00:00:01Z',
                loading: false,
              },
            ],
            run_id: 1,
            status: 'completed',
            updated_at: '2024-01-01T00:00:01Z',
          },
        },
      });

      const {result} = renderHookWithProviders(() => useSeerExplorer(), {organization});

      await act(async () => {
        await result.current.sendMessage('Test');
      });

      // isTimedOut should remain false — the timeout callback was never triggered
      expect(result.current.isTimedOut).toBe(false);
    });

    it('polling timeout timer is cancelled when a request errors', async () => {
      const chatUrl = `/organizations/${organization.slug}/seer/explorer-chat/`;

      MockApiClient.addMockResponse({url: chatUrl, method: 'GET', body: {session: null}});
      MockApiClient.addMockResponse({
        url: chatUrl,
        method: 'POST',
        statusCode: 500,
        body: {detail: 'Server error'},
      });

      const {result} = renderHookWithProviders(() => useSeerExplorer(), {organization});

      await act(async () => {
        await result.current.sendMessage('Test');
      });

      // cancelPollingTimeout is called via _onRequestError when the API errors
      expect(mockTimeoutCancel).toHaveBeenCalled();
      expect(result.current.isTimedOut).toBe(false);
    });

    it('isTimedOut resets to false when switching to a different run', async () => {
      const chatUrl = `/organizations/${organization.slug}/seer/explorer-chat/`;

      MockApiClient.addMockResponse({url: chatUrl, method: 'GET', body: {session: null}});
      MockApiClient.addMockResponse({url: chatUrl, method: 'POST', body: {run_id: 1}});
      MockApiClient.addMockResponse({
        url: `${chatUrl}1/`,
        method: 'GET',
        body: {
          session: {
            blocks: [],
            run_id: 1,
            status: 'processing',
            updated_at: '2024-01-01T00:00:00Z',
          },
        },
      });
      MockApiClient.addMockResponse({
        url: `${chatUrl}999/`,
        method: 'GET',
        body: {
          session: {
            blocks: [],
            run_id: 999,
            status: 'completed',
            updated_at: '2024-01-01T00:00:00Z',
          },
        },
      });

      const {result} = renderHookWithProviders(() => useSeerExplorer(), {organization});

      await act(async () => {
        await result.current.sendMessage('Test');
      });
      act(() => {
        capturedOnTimeout?.();
      });
      expect(result.current.isTimedOut).toBe(true);

      act(() => {
        result.current.switchToRun(999);
      });

      expect(result.current.isTimedOut).toBe(false);
    });

    it('isPolling is true while waiting for response and false after timeout fires', async () => {
      const chatUrl = `/organizations/${organization.slug}/seer/explorer-chat/`;

      MockApiClient.addMockResponse({url: chatUrl, method: 'GET', body: {session: null}});
      MockApiClient.addMockResponse({url: chatUrl, method: 'POST', body: {run_id: 1}});
      MockApiClient.addMockResponse({
        url: `${chatUrl}1/`,
        method: 'GET',
        body: {
          session: {
            blocks: [],
            run_id: 1,
            status: 'processing',
            updated_at: '2024-01-01T00:00:00Z',
          },
        },
      });

      const {result} = renderHookWithProviders(() => useSeerExplorer(), {organization});

      expect(result.current.isPolling).toBe(false);

      await act(async () => {
        await result.current.sendMessage('Test');
      });

      // isPolling is true while the request is in flight (waitingForResponse=true)
      expect(result.current.isPolling).toBe(true);

      // Firing the timeout clears waitingForResponse, which stops polling
      act(() => {
        capturedOnTimeout?.();
      });

      expect(result.current.isPolling).toBe(false);
    });
  });
});
