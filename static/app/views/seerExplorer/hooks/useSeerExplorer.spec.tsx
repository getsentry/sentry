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
      jest.mocked(usePageReferrer).mockReturnValue({
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

    it('falls back to ASCII screenshot on non-structured-context page', async () => {
      jest.mocked(usePageReferrer).mockReturnValue({
        getPageReferrer: () => '/monitors/mobile-builds/',
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
        // /monitors/mobile-builds/ is not in STRUCTURED_CONTEXT_ROUTES — falls back to ASCII snapshot
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

  describe('switching sessions', () => {
    beforeEach(() => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/seer/explorer-chat/123/`,
        method: 'GET',
        body: {session: {blocks: [], status: 'completed'}},
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/seer/explorer-chat/123/`,
        method: 'POST',
        body: {run_id: 123},
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/seer/explorer-update/123/`,
        method: 'POST',
        body: {run_id: 123},
      });

      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/seer/explorer-chat/`,
        method: 'GET',
        body: {session: null},
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/seer/explorer-chat/456/`,
        method: 'GET',
        body: {session: {blocks: [], status: 'completed'}},
      });
    });

    it('startNewSession resets session state', async () => {
      sessionStorage.setItem('seer-explorer-run-id', JSON.stringify(123));

      const {result} = renderHookWithProviders(() => useSeerExplorer(), {
        organization,
      });

      act(() => {
        result.current.sendMessage('Test query');
        result.current.interruptRun();
      });

      // Wait for the interrupt mutation to complete before resetting
      await waitFor(() => {
        expect(result.current.hasSentInterrupt).toBe(true);
      });

      act(() => {
        result.current.startNewSession();
      });

      expect(result.current.runId).toBeNull();
      expect(result.current.hasSentInterrupt).toBe(false);
    });

    it('switchToRun sets runId and resets session state', async () => {
      sessionStorage.setItem('seer-explorer-run-id', JSON.stringify(123));

      const {result} = renderHookWithProviders(() => useSeerExplorer(), {
        organization,
      });

      act(() => {
        result.current.sendMessage('Test query');
        result.current.interruptRun();
      });

      // Wait for the interrupt mutation to complete before switching
      await waitFor(() => {
        expect(result.current.hasSentInterrupt).toBe(true);
      });

      act(() => {
        result.current.switchToRun(456);
      });

      await waitFor(() => {
        expect(result.current.runId).toBe(456);
        expect(result.current.hasSentInterrupt).toBe(false);
      });
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
    it('sets optimistic blocks when session is processing with no user block in DB', async () => {
      const chatUrl = `/organizations/${organization.slug}/seer/explorer-chat/`;

      MockApiClient.addMockResponse({url: chatUrl, method: 'GET', body: {session: null}});
      MockApiClient.addMockResponse({url: chatUrl, method: 'POST', body: {run_id: 456}});
      MockApiClient.addMockResponse({
        url: `${chatUrl}456/`,
        method: 'GET',
        body: {
          session: {
            blocks: [],
            run_id: 456,
            status: 'processing',
            updated_at: new Date().toISOString(),
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
      expect(blocks).toHaveLength(2);
      expect(
        blocks[0]?.message.role === 'user' && blocks[0]?.id.includes('optimistic')
      ).toBe(true);
      expect(
        blocks[1]?.message.role === 'assistant' &&
          blocks[1]?.id.includes('optimistic') &&
          blocks[1]?.loading
      ).toBe(true);
    });

    it('sets optimistic blocks when session is processing with no assistant response in DB', async () => {
      const chatUrl = `/organizations/${organization.slug}/seer/explorer-chat/`;

      MockApiClient.addMockResponse({url: chatUrl, method: 'GET', body: {session: null}});
      MockApiClient.addMockResponse({url: chatUrl, method: 'POST', body: {run_id: 456}});
      MockApiClient.addMockResponse({
        url: `${chatUrl}456/`,
        method: 'GET',
        body: {
          session: {
            blocks: [
              // Persisted user block with a future timestamp.
              {
                id: 'user-0',
                message: {role: 'user', content: 'Test'},
                timestamp: new Date(Date.now() + 30_000).toISOString(),
                loading: false,
              },
              // Missing assistant response.
            ],
            run_id: 456,
            status: 'processing',
            updated_at: new Date(Date.now() + 30_000).toISOString(),
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
      expect(blocks).toHaveLength(2);
      expect(
        blocks[0]?.message.role === 'user' && blocks[0]?.id.includes('optimistic')
      ).toBe(true);
      expect(
        blocks[1]?.message.role === 'assistant' &&
          blocks[1]?.id.includes('optimistic') &&
          blocks[1]?.loading
      ).toBe(true);
    });

    it('does not set optimistic blocks when session is processing with user and assistant blocks in DB', async () => {
      const chatUrl = `/organizations/${organization.slug}/seer/explorer-chat/`;
      const serverSessionData = {
        blocks: [
          // Persisted user block with a future timestamp.
          {
            id: 'user-0',
            message: {role: 'user', content: 'Test'},
            timestamp: new Date(Date.now() + 30_000).toISOString(),
            loading: false,
          },
          // Assistant response with a future timestamp.
          {
            id: 'assistant-1-loading',
            message: {role: 'assistant', content: 'Loading...'},
            timestamp: new Date(Date.now() + 31_000).toISOString(),
            loading: true,
          },
        ],
        run_id: 456,
        status: 'processing',
        updated_at: new Date(Date.now() + 31_000).toISOString(),
      };

      MockApiClient.addMockResponse({url: chatUrl, method: 'GET', body: {session: null}});
      MockApiClient.addMockResponse({url: chatUrl, method: 'POST', body: {run_id: 456}});
      MockApiClient.addMockResponse({
        url: `${chatUrl}456/`,
        method: 'GET',
        body: {
          session: serverSessionData,
        },
      });

      const {result} = renderHookWithProviders(() => useSeerExplorer(), {
        organization,
      });

      act(() => {
        result.current.sendMessage('Test');
      });

      await waitFor(() => {
        expect(result.current.sessionData).toEqual(serverSessionData);
      });
    });

    it('does not set optimistic blocks when session is processing with user and tool blocks in DB', async () => {
      const chatUrl = `/organizations/${organization.slug}/seer/explorer-chat/`;
      const serverSessionData = {
        blocks: [
          // Persisted user block with a future timestamp.
          {
            id: 'user-0',
            message: {role: 'user', content: 'Test'},
            timestamp: new Date(Date.now() + 30_000).toISOString(),
            loading: false,
          },
          // Tool use with a future timestamp.
          {
            id: 'tool-1-loading',
            message: {role: 'tool_use', content: 'Loading...'},
            timestamp: new Date(Date.now() + 31_000).toISOString(),
            loading: true,
          },
        ],
        run_id: 456,
        status: 'processing',
        updated_at: new Date(Date.now() + 31_000).toISOString(),
      };

      MockApiClient.addMockResponse({url: chatUrl, method: 'GET', body: {session: null}});
      MockApiClient.addMockResponse({url: chatUrl, method: 'POST', body: {run_id: 456}});
      MockApiClient.addMockResponse({
        url: `${chatUrl}456/`,
        method: 'GET',
        body: {
          session: serverSessionData,
        },
      });

      const {result} = renderHookWithProviders(() => useSeerExplorer(), {
        organization,
      });

      act(() => {
        result.current.sendMessage('Test');
      });

      await waitFor(() => {
        expect(result.current.sessionData).toEqual(serverSessionData);
      });
    });

    it('does not set optimistic blocks when session is processing with user and multiple tool blocks in DB', async () => {
      const chatUrl = `/organizations/${organization.slug}/seer/explorer-chat/`;
      const serverSessionData = {
        blocks: [
          // Persisted user block with a future timestamp.
          {
            id: 'user-0',
            message: {role: 'user', content: 'Test'},
            timestamp: new Date(Date.now() + 30_000).toISOString(),
            loading: false,
          },
          // Tool uses with a future timestamp.
          {
            id: 'tool-1',
            message: {role: 'tool_use', content: 'Tool 1 result'},
            timestamp: new Date(Date.now() + 31_000).toISOString(),
            loading: false,
          },
          {
            id: 'tool-2',
            message: {role: 'tool_use', content: 'Tool 2 result'},
            timestamp: new Date(Date.now() + 32_000).toISOString(),
            loading: false,
          },
          {
            id: 'assistant-3-loading',
            message: {role: 'assistant', content: 'loading...'},
            timestamp: new Date(Date.now() + 33_000).toISOString(),
            loading: true,
          },
        ],
        run_id: 456,
        status: 'processing',
        updated_at: new Date(Date.now() + 33_000).toISOString(),
      };

      MockApiClient.addMockResponse({url: chatUrl, method: 'GET', body: {session: null}});
      MockApiClient.addMockResponse({url: chatUrl, method: 'POST', body: {run_id: 456}});
      MockApiClient.addMockResponse({
        url: `${chatUrl}456/`,
        method: 'GET',
        body: {
          session: serverSessionData,
        },
      });

      const {result} = renderHookWithProviders(() => useSeerExplorer(), {
        organization,
      });

      act(() => {
        result.current.sendMessage('Test');
      });

      await waitFor(() => {
        expect(result.current.sessionData).toEqual(serverSessionData);
      });
    });

    it('does not set optimistic blocks when session completes normally', async () => {
      const chatUrl = `/organizations/${organization.slug}/seer/explorer-chat/`;
      const serverSessionData = {
        blocks: [
          // Persisted user block with a future timestamp.
          {
            id: 'user-0',
            message: {role: 'user', content: 'Test'},
            timestamp: new Date(Date.now() + 30_000).toISOString(),
            loading: false,
          },
          // Assistant response with a future timestamp.
          {
            id: 'assistant-1',
            message: {role: 'assistant', content: 'Response content'},
            timestamp: new Date(Date.now() + 31_000).toISOString(),
            loading: false,
          },
        ],
        run_id: 456,
        status: 'completed',
        updated_at: new Date(Date.now() + 31_000).toISOString(),
      };

      MockApiClient.addMockResponse({url: chatUrl, method: 'GET', body: {session: null}});
      MockApiClient.addMockResponse({url: chatUrl, method: 'POST', body: {run_id: 456}});
      MockApiClient.addMockResponse({
        url: `${chatUrl}456/`,
        method: 'GET',
        body: {
          session: serverSessionData,
        },
      });

      const {result} = renderHookWithProviders(() => useSeerExplorer(), {
        organization,
      });

      act(() => {
        result.current.sendMessage('Test');
      });

      await waitFor(() => {
        expect(result.current.sessionData).toEqual(serverSessionData);
      });
    });

    it('does not set optimistic blocks when session completes without response', async () => {
      const chatUrl = `/organizations/${organization.slug}/seer/explorer-chat/`;
      const serverSessionData = {
        blocks: [],
        run_id: 321,
        status: 'completed',
        updated_at: new Date().toISOString(),
      };

      MockApiClient.addMockResponse({url: chatUrl, method: 'GET', body: {session: null}});
      MockApiClient.addMockResponse({url: chatUrl, method: 'POST', body: {run_id: 321}});
      MockApiClient.addMockResponse({
        url: `${chatUrl}321/`,
        method: 'GET',
        body: {
          session: serverSessionData,
        },
      });

      const {result} = renderHookWithProviders(() => useSeerExplorer(), {
        organization,
      });

      act(() => {
        result.current.sendMessage('Test');
      });

      await waitFor(() => {
        expect(result.current.sessionData).toEqual(serverSessionData);
      });
    });

    it('does not set optimistic blocks when session errors', async () => {
      const chatUrl = `/organizations/${organization.slug}/seer/explorer-chat/`;
      const serverSessionData = {
        blocks: [],
        run_id: 321,
        status: 'error',
        updated_at: new Date().toISOString(),
      };

      MockApiClient.addMockResponse({url: chatUrl, method: 'GET', body: {session: null}});
      MockApiClient.addMockResponse({url: chatUrl, method: 'POST', body: {run_id: 321}});
      MockApiClient.addMockResponse({
        url: `${chatUrl}321/`,
        method: 'GET',
        body: {
          session: serverSessionData,
        },
      });

      const {result} = renderHookWithProviders(() => useSeerExplorer(), {
        organization,
      });

      act(() => {
        result.current.sendMessage('Test');
      });

      await waitFor(() => {
        expect(result.current.sessionData).toEqual(serverSessionData);
      });
    });

    it('does not set optimistic blocks when send message errors', async () => {
      const chatUrl = `/organizations/${organization.slug}/seer/explorer-chat/`;

      MockApiClient.addMockResponse({url: chatUrl, method: 'GET', body: {session: null}});
      MockApiClient.addMockResponse({
        url: chatUrl,
        method: 'POST',
        statusCode: 500,
        body: {run_id: 321, detail: 'Server error'},
      });

      // runId = 321 should not be set on POST error, so it should never be fetched.
      const getMock = MockApiClient.addMockResponse({
        url: `${chatUrl}321/`,
        method: 'GET',
        body: {session: null},
      });

      const {result} = renderHookWithProviders(() => useSeerExplorer(), {
        organization,
      });

      act(() => {
        result.current.sendMessage('Test');
      });

      await waitFor(() => {
        expect(result.current.sessionData).toBeNull();
        // Should not set api data when runId is null.
      });

      expect(getMock).not.toHaveBeenCalled();
    });
  });

  describe('Timeout Detection', () => {
    const chatUrl = `/organizations/${organization.slug}/seer/explorer-chat/`;
    const runId = 777;
    const staleUpdatedAt = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    it('returns isTimedOut=true and isPolling=false and does not re-poll', async () => {
      const getMock = MockApiClient.addMockResponse({
        url: `${chatUrl}${runId}/`,
        method: 'GET',
        body: {
          session: {
            blocks: [],
            run_id: runId,
            status: 'processing',
            updated_at: staleUpdatedAt,
          },
        },
      });

      const {result} = renderHookWithProviders(() => useSeerExplorer(), {organization});

      act(() => {
        result.current.switchToRun(runId);
      });

      await waitFor(() => {
        expect(result.current.isTimedOut).toBe(true);
      });

      expect(result.current.isPolling).toBe(false);
      expect(getMock).toHaveBeenCalledTimes(1);
    });

    it('filters out loading blocks from sessionData when timed out', async () => {
      MockApiClient.addMockResponse({
        url: `${chatUrl}${runId}/`,
        method: 'GET',
        body: {
          session: {
            blocks: [
              {
                id: 'msg-1',
                message: {role: 'user', content: 'Hello'},
                timestamp: staleUpdatedAt,
                loading: false,
              },
              {
                id: 'msg-2',
                message: {role: 'assistant', content: 'Partial...'},
                timestamp: staleUpdatedAt,
                loading: true,
              },
              {
                id: 'msg-3',
                message: {role: 'tool_use', content: 'Running tool...'},
                timestamp: staleUpdatedAt,
                loading: true,
              },
            ],
            run_id: runId,
            status: 'processing',
            updated_at: staleUpdatedAt,
          },
        },
      });

      const {result} = renderHookWithProviders(() => useSeerExplorer(), {organization});

      act(() => {
        result.current.switchToRun(runId);
      });

      await waitFor(() => {
        expect(result.current.isTimedOut).toBe(true);
      });

      expect(result.current.isPolling).toBe(false);
      expect(result.current.sessionData?.blocks).toHaveLength(1);
      expect(result.current.sessionData?.blocks[0]?.id).toBe('msg-1');
    });
  });

  describe('hasSentInterrupt', () => {
    beforeEach(() => {
      sessionStorage.setItem('seer-explorer-run-id', JSON.stringify(123));
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/seer/explorer-chat/123/`,
        method: 'GET',
        body: {session: {blocks: [], status: 'completed'}},
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/seer/explorer-chat/123/`,
        method: 'POST',
        body: {run_id: 123},
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/seer/explorer-update/123/`,
        method: 'POST',
        body: {run_id: 123},
      });
    });

    it('clears after new message is sent', async () => {
      const {result} = renderHookWithProviders(() => useSeerExplorer(), {
        organization,
      });

      expect(result.current.hasSentInterrupt).toBe(false);

      act(() => {
        result.current.interruptRun();
      });

      await waitFor(() => {
        expect(result.current.hasSentInterrupt).toBe(true);
      });

      act(() => {
        result.current.sendMessage('Test 2');
      });

      await waitFor(() => {
        expect(result.current.hasSentInterrupt).toBe(false);
      });
    });

    it('clears after respondToUserInput is called', async () => {
      const {result} = renderHookWithProviders(() => useSeerExplorer(), {
        organization,
      });

      expect(result.current.hasSentInterrupt).toBe(false);

      act(() => {
        result.current.interruptRun();
      });

      await waitFor(() => {
        expect(result.current.hasSentInterrupt).toBe(true);
      });

      act(() => {
        result.current.respondToUserInput('test-input-id', {});
      });

      await waitFor(() => {
        expect(result.current.hasSentInterrupt).toBe(false);
      });
    });

    it('clears after createPR is called', async () => {
      const {result} = renderHookWithProviders(() => useSeerExplorer(), {
        organization,
      });

      expect(result.current.hasSentInterrupt).toBe(false);

      act(() => {
        result.current.interruptRun();
      });

      await waitFor(() => {
        expect(result.current.hasSentInterrupt).toBe(true);
      });

      act(() => {
        result.current.createPR('test-repo-name');
      });

      await waitFor(() => {
        expect(result.current.hasSentInterrupt).toBe(false);
      });
    });
  });

  describe('timeout logic', () => {});
});
