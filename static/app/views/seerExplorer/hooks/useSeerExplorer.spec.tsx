import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {useLLMContext} from 'sentry/views/seerExplorer/contexts/llmContext';
import {usePageReferrer} from 'sentry/views/seerExplorer/utils';

import {useSeerExplorer} from './useSeerExplorer';

jest.mock('sentry/views/seerExplorer/utils', () => ({
  ...jest.requireActual('sentry/views/seerExplorer/utils'),
  usePageReferrer: jest.fn(),
}));

jest.mock('sentry/views/seerExplorer/contexts/llmContext', () => ({
  ...jest.requireActual('sentry/views/seerExplorer/contexts/llmContext'),
  useLLMContext: jest.fn(),
}));

describe('useSeerExplorer', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    sessionStorage.clear();
    (usePageReferrer as jest.Mock).mockReturnValue({
      getPageReferrer: () => '/issues/',
    });
    (useLLMContext as jest.Mock).mockReturnValue({
      getLLMContext: () => ({version: 0, nodes: []}),
    });
  });

  const organization = OrganizationFixture({
    features: ['seer-explorer', 'gen-ai-features'],
    hideAiFeatures: false,
    openMembership: true,
  });

  describe('Initial State', () => {
    it('returns initial state with no session data', () => {
      const {result} = renderHookWithProviders(() => useSeerExplorer(), {
        organization,
      });

      expect(result.current.sessionData).toBeNull();
      expect(result.current.isPolling).toBe(false);
      expect(result.current.runId).toBeNull();
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

      act(() => {
        result.current.sendMessage('Test query');
      });

      await waitFor(() => {
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

        // Run ID is set to response.run_id
        expect(result.current.runId).toBe(123);
      });
    });

    it('sends structured JSON on dashboard page with feature flag', async () => {
      (usePageReferrer as jest.Mock).mockReturnValue({
        getPageReferrer: () => '/dashboard/:dashboardId/',
      });
      const org = OrganizationFixture({
        features: ['seer-explorer', 'seer-explorer-context-engine'],
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
      act(() => {
        result.current.sendMessage('q');
      });

      await waitFor(() => {
        const ctx = postMock.mock.calls[0][1].data.on_page_context;
        expect(JSON.parse(ctx)).toHaveProperty('nodes');
      });
    });

    it('falls back to ASCII screenshot on non-dashboard page', async () => {
      const org = OrganizationFixture({
        features: ['seer-explorer', 'seer-explorer-context-engine'],
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
      act(() => {
        result.current.sendMessage('q');
      });

      await waitFor(() => {
        // usePageReferrer returns '/issues/' by default (from beforeEach) — not in STRUCTURED_CONTEXT_ROUTES
        const ctx = postMock.mock.calls[0][1].data.on_page_context;
        expect(() => JSON.parse(ctx)).toThrow();
      });
    });

    it('handles API errors gracefully', async () => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/seer/explorer-chat/`,
        method: 'GET',
        body: {session: {blocks: [], status: 'completed'}},
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
      act(() => {
        result.current.sendMessage('Test query');
      });
      await waitFor(() => {
        expect(result.current.isPolling).toBe(false);
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
    });
  });

  describe('Polling Logic', () => {
    const chatUrl = `/organizations/${organization.slug}/seer/explorer-chat/`;
    const runId = 999;

    it('returns false for polling when no session exists', () => {
      const {result} = renderHookWithProviders(() => useSeerExplorer(), {
        organization,
      });

      expect(result.current.isPolling).toBe(false);
    });

    it('returns true for polling when session exists with processing status', async () => {
      MockApiClient.addMockResponse({
        url: `${chatUrl}${runId}/`,
        method: 'GET',
        body: {runId, session: {status: 'processing'}},
      });

      const {result} = renderHookWithProviders(() => useSeerExplorer(), {
        organization,
      });
      act(() => {
        result.current.switchToRun(runId);
      });
      await waitFor(() => {
        expect(result.current.isPolling).toBe(true);
      });
    });

    it('returns true for polling when session exists with loading blocks', async () => {
      MockApiClient.addMockResponse({
        url: `${chatUrl}${runId}/`,
        method: 'GET',
        body: {runId, session: {blocks: [{loading: true}]}},
      });

      const {result} = renderHookWithProviders(() => useSeerExplorer(), {
        organization,
      });
      act(() => {
        result.current.switchToRun(runId);
      });
      await waitFor(() => {
        expect(result.current.isPolling).toBe(true);
      });
    });

    it('returns true for polling when session exists with creating PR states', async () => {
      MockApiClient.addMockResponse({
        url: `${chatUrl}${runId}/`,
        method: 'GET',
        body: {
          runId,
          session: {repo_pr_states: {repo1: {pr_creation_status: 'creating'}}},
        },
      });

      const {result} = renderHookWithProviders(() => useSeerExplorer(), {
        organization,
      });
      act(() => {
        result.current.switchToRun(runId);
      });
      await waitFor(() => {
        expect(result.current.isPolling).toBe(true);
      });
    });

    it('returns false for polling when session exists with completed status and no creating PRs', async () => {
      MockApiClient.addMockResponse({
        url: `${chatUrl}${runId}/`,
        method: 'GET',
        body: {
          runId,
          session: {
            status: 'completed',
            blocks: [],
            repo_pr_states: {repo1: {pr_creation_status: 'completed'}},
          },
        },
      });

      const {result} = renderHookWithProviders(() => useSeerExplorer(), {
        organization,
      });
      act(() => {
        result.current.switchToRun(runId);
      });
      await waitFor(() => {
        expect(result.current.isPolling).toBe(false);
      });
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

      const {result} = renderHookWithProviders(() => useSeerExplorer(), {
        organization,
      });

      act(() => {
        result.current.sendMessage('Test');
      });

      await waitFor(() => {
        expect((result.current.sessionData?.blocks ?? []).length).toBeGreaterThan(0);
      });

      const blocks = result.current.sessionData?.blocks ?? [];
      expect(blocks.some(b => b.message.role === 'assistant' && b.loading)).toBe(true);
    });

    it('clears optimistic state when session completes without an assistant response', async () => {
      const chatUrl = `/organizations/${organization.slug}/seer/explorer-chat/`;
      const ts = '2024-01-01T00:00:00Z';

      MockApiClient.addMockResponse({url: chatUrl, method: 'GET', body: {session: null}});
      MockApiClient.addMockResponse({url: chatUrl, method: 'POST', body: {run_id: 321}});
      MockApiClient.addMockResponse({
        url: `${chatUrl}321/`,
        method: 'GET',
        body: {
          session: {
            blocks: [
              {
                id: 'user-1',
                message: {role: 'user', content: 'Test'},
                timestamp: ts,
                loading: false,
              },
            ],
            run_id: 321,
            status: 'completed',
            updated_at: ts,
          },
        },
      });

      const {result} = renderHookWithProviders(() => useSeerExplorer(), {
        organization,
      });

      act(() => {
        result.current.sendMessage('Test');
      });

      await waitFor(() => {
        const blocks = result.current.sessionData?.blocks ?? [];
        expect(blocks.some(b => b.loading)).toBe(false);
        expect(blocks).toHaveLength(1);
      });
    });
  });
});
