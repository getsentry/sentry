import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

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
});
