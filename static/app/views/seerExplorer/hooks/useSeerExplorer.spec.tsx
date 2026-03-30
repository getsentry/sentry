import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {useSeerExplorer} from './useSeerExplorer';

describe('useSeerExplorer', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    sessionStorage.clear();
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
});
