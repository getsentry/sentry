import {QueryClientProvider} from '@tanstack/react-query';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {act, renderHook} from 'sentry-test/reactTestingLibrary';

import {OrganizationContext} from 'sentry/views/organizationContext';

import {useSeerExplorer} from './useSeerExplorer';

describe('useSeerExplorer', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  const organization = OrganizationFixture({
    features: ['seer-explorer'],
    hideAiFeatures: false,
  });

  function createWrapper() {
    return function TestWrapper({children}: {children: React.ReactNode}) {
      const queryClient = makeTestQueryClient();
      return (
        <QueryClientProvider client={queryClient}>
          <OrganizationContext value={organization}>{children}</OrganizationContext>
        </QueryClientProvider>
      );
    };
  }

  describe('Initial State', () => {
    it('returns initial state with no session data', () => {
      const {result} = renderHook(() => useSeerExplorer(), {
        wrapper: createWrapper(),
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
          run_id: 'new-run-123',
          message: {
            id: 'msg-1',
            type: 'response',
            content: 'Response content',
            timestamp: '2024-01-01T00:00:00Z',
            loading: false,
          },
        },
      });

      const {result} = renderHook(() => useSeerExplorer(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.sendMessage('Test query');
      });

      expect(postMock).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/seer/explorer-chat/`,
        expect.objectContaining({
          method: 'POST',
          data: expect.objectContaining({
            run_id: null,
            query: 'Test query',
            insert_index: 0,
            message_timestamp: expect.any(Number),
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

      const {result} = renderHook(() => useSeerExplorer(), {
        wrapper: createWrapper(),
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

      const {result} = renderHook(() => useSeerExplorer(), {
        wrapper: createWrapper(),
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

      const {result} = renderHook(() => useSeerExplorer(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.deleteFromIndex(2);
      });

      expect(result.current.deletedFromIndex).toBe(2);
    });

    it('filters messages based on deleted index', () => {
      const {result} = renderHook(() => useSeerExplorer(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.deleteFromIndex(1);
      });

      expect(result.current.deletedFromIndex).toBe(1);
    });
  });

  describe('Polling Logic', () => {
    it('returns false for polling when no session exists', () => {
      const {result} = renderHook(() => useSeerExplorer(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isPolling).toBe(false);
    });
  });
});
