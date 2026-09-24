import moment from 'moment-timezone';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import * as llmContextModule from 'sentry/views/seerExplorer/contexts/llmContext';
import {SeerExplorerChatStateProvider} from 'sentry/views/seerExplorer/seerExplorerChatStateContext';
import * as seerExplorerUtils from 'sentry/views/seerExplorer/utils';

import {useSeerExplorer} from './useSeerExplorer';

describe('useSeerExplorer', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    sessionStorage.clear();
    jest.spyOn(seerExplorerUtils, 'usePageReferrer').mockReturnValue({
      getPageReferrer: () => '/issues/',
    });
    jest.spyOn(llmContextModule, 'useLLMContext').mockReturnValue({
      getLLMContext: () => ({
        version: 0,
        nodes: [],
        location: {
          url: window.location.href,
          name: '/issues/',
          params: {},
          query: {},
        },
      }),
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
        additionalWrapper: SeerExplorerChatStateProvider,
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
        additionalWrapper: SeerExplorerChatStateProvider,
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
      jest.spyOn(seerExplorerUtils, 'usePageReferrer').mockReturnValue({
        getPageReferrer: () => '/dashboard/:dashboardId/',
      });
      const org = OrganizationFixture({
        features: ['seer-explorer'],
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

    it.each([
      '/issues/:groupId/replays/',
      '/issues/:groupId/attachments/',
      '/issues/:groupId/distributions/',
      '/issues/:groupId/distributions/:tagKey/',
      '/explore/logs/trace/:traceSlug/',
      '/explore/replays/',
      '/explore/replays/:replaySlug/',
      '/monitors/',
      '/monitors/:detectorId/',
      '/monitors/:detectorId/edit/',
      '/monitors/alerts/',
      '/monitors/alerts/:automationId/',
      '/monitors/alerts/:automationId/edit/',
      '/monitors/crons/',
      '/monitors/errors/',
      '/monitors/metrics/',
      '/monitors/mobile-builds/',
      '/monitors/my-monitors/',
      '/monitors/uptime/',
    ])('sends structured JSON on structured-context route %s', async (route: string) => {
      jest.spyOn(seerExplorerUtils, 'usePageReferrer').mockReturnValue({
        getPageReferrer: () => route,
      });
      const org = OrganizationFixture({
        features: ['seer-explorer'],
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
      jest.spyOn(seerExplorerUtils, 'usePageReferrer').mockReturnValue({
        getPageReferrer: () => '/settings/account/details/',
      });
      const org = OrganizationFixture({
        features: ['seer-explorer'],
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
        // /settings/account/details/ is not in STRUCTURED_CONTEXT_ROUTES — falls back to ASCII snapshot
        const ctx = postMock.mock.calls[0][1].data.on_page_context;
        expect(() => JSON.parse(ctx)).toThrow();
      });
    });

    it('sends page_location even on a non-structured-context page', async () => {
      jest.spyOn(seerExplorerUtils, 'usePageReferrer').mockReturnValue({
        getPageReferrer: () => '/settings/account/details/',
      });
      const org = OrganizationFixture({features: ['seer-explorer']});
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

      // Location is independent of the structured-context allowlist — the ASCII
      // branch reports it too.
      await waitFor(() => {
        expect(postMock.mock.calls[0][1].data.page_location).toEqual(
          expect.objectContaining({url: window.location.href})
        );
        // Local (zone name in brackets) then UTC, as display strings.
        const sentAt = postMock.mock.calls[0][1].data.sent_at;
        expect(sentAt).toHaveLength(2);
        expect(sentAt[1]).toMatch(/(Z|\+00:00)$/);

        // The offset and the bracketed zone name must describe the same zone.
        // ConfigStore points moment's default at the account timezone preference,
        // so deriving them from different sources yields a contradictory string.
        const [, offset, zone] = sentAt[0].match(/([+-]\d{2}:\d{2}|Z)\[(.+)\]$/) ?? [];
        expect(zone).toBeTruthy();
        expect(moment.tz(zone).format('Z')).toBe(offset === 'Z' ? '+00:00' : offset);
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
        additionalWrapper: SeerExplorerChatStateProvider,
      });

      // Should handle error without throwing
      act(() => {
        result.current.sendMessage('Test query');
      });
      await waitFor(() => {
        expect(result.current.isPolling).toBe(false);
      });
    });

    it('keeps the existing chat and exposes the failed query when sending fails', async () => {
      const runId = 'run-with-history';
      const existingBlocks = [
        {
          id: 'user-1',
          message: {role: 'user', content: 'First question'},
          timestamp: '2024-01-01T00:00:00Z',
          loading: false,
        },
        {
          id: 'assistant-1',
          message: {role: 'assistant', content: 'First answer'},
          timestamp: '2024-01-01T00:00:01Z',
          loading: false,
        },
      ];
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/seer/explorer-chat/${runId}/`,
        method: 'GET',
        body: {session: {blocks: existingBlocks, status: 'completed'}},
      });
      const postMock = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/seer/explorer-chat/${runId}/`,
        method: 'POST',
        statusCode: 500,
        body: {detail: 'Server error'},
      });

      const {result} = renderHookWithProviders(() => useSeerExplorer(), {
        organization,
        additionalWrapper: SeerExplorerChatStateProvider,
      });
      act(() => {
        result.current.switchToRun(runId);
      });
      await waitFor(() => {
        expect(result.current.sessionData?.blocks).toHaveLength(2);
      });

      act(() => {
        result.current.sendMessage('Second question');
      });

      await waitFor(() => {
        expect(result.current.requestError).toEqual({query: 'Second question'});
      });
      expect(postMock).toHaveBeenCalled();
      expect(result.current.sessionData?.status).toBe('completed');
      expect(result.current.sessionData?.blocks.map(b => b.message.content)).toEqual([
        'First question',
        'First answer',
      ]);

      // The error stays up until a later request succeeds.
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/seer/explorer-chat/${runId}/`,
        method: 'POST',
        body: {run_id: 1},
      });
      act(() => {
        result.current.sendMessage('Second question');
      });
      expect(result.current.requestError).toEqual({query: 'Second question'});
      await waitFor(() => {
        expect(result.current.requestError).toBeNull();
      });
    });

    it('keeps the chat and pending question when answering fails', async () => {
      const runId = 'run-with-question';
      const pendingInput = {
        id: 'input-1',
        input_type: 'ask_user_question' as const,
        data: {questions: [{question: 'Which one?', options: [{label: 'A'}]}]},
      };
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/seer/explorer-chat/${runId}/`,
        method: 'GET',
        body: {
          session: {
            blocks: [
              {
                id: 'user-1',
                message: {role: 'user', content: 'First question'},
                timestamp: '2024-01-01T00:00:00Z',
                loading: false,
              },
            ],
            status: 'awaiting_user_input',
            pending_user_input: pendingInput,
          },
        },
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/seer/explorer-update/${runId}/`,
        method: 'POST',
        statusCode: 500,
        body: {detail: 'Server error'},
      });
      const onError = jest.fn();

      const {result} = renderHookWithProviders(() => useSeerExplorer(), {
        organization,
        additionalWrapper: SeerExplorerChatStateProvider,
      });
      act(() => {
        result.current.switchToRun(runId);
      });
      await waitFor(() => {
        expect(result.current.sessionData?.status).toBe('awaiting_user_input');
      });

      act(() => {
        result.current.respondToUserInput('input-1', {answers: ['A']}, {onError});
      });

      await waitFor(() => {
        expect(result.current.requestError).toEqual({});
      });
      expect(onError).toHaveBeenCalled();
      expect(result.current.sessionData?.status).toBe('awaiting_user_input');
      expect(result.current.sessionData?.pending_user_input).toEqual(pendingInput);
      expect(result.current.sessionData?.blocks.map(b => b.message.content)).toEqual([
        'First question',
      ]);
    });

    it('keeps a newer send in another chat when an older send fails', async () => {
      const runId = 'run-a';
      let failOldSend!: () => void;
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/seer/explorer-chat/${runId}/`,
        method: 'GET',
        body: {session: {blocks: [], status: 'completed'}},
      });
      const oldSendMock = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/seer/explorer-chat/${runId}/`,
        method: 'POST',
        statusCode: 500,
        body: {detail: 'Server error'},
        asyncDelay: new Promise<void>(resolve => {
          failOldSend = resolve;
        }),
      });
      // The new chat's send stays in flight for the rest of the test.
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/seer/explorer-chat/`,
        method: 'POST',
        body: {run_id: 1},
        asyncDelay: new Promise<void>(() => {}),
      });

      const {result} = renderHookWithProviders(() => useSeerExplorer(), {
        organization,
        additionalWrapper: SeerExplorerChatStateProvider,
      });
      act(() => {
        result.current.switchToRun(runId);
      });
      await waitFor(() => {
        expect(result.current.sessionData?.status).toBe('completed');
      });

      act(() => {
        result.current.sendMessage('Old chat question');
      });
      act(() => {
        result.current.startNewSession();
      });
      act(() => {
        result.current.sendMessage('New chat question');
      });
      expect(result.current.sessionData?.blocks[0]?.message.content).toBe(
        'New chat question'
      );

      // Let the old request fail and its error handling run to completion.
      await act(async () => {
        failOldSend();
        for (let i = 0; i < 5; i++) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      });
      expect(oldSendMock).toHaveBeenCalled();

      // The old failure must not drop the new chat's optimistic blocks or show its error.
      expect(result.current.sessionData?.blocks[0]?.message.content).toBe(
        'New chat question'
      );
      expect(result.current.requestError).toBeNull();
    });

    it('keeps the alert when an older send succeeds after a newer send failed', async () => {
      const runId = 'run-stale';
      let settleFirstSend!: () => void;
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/seer/explorer-chat/${runId}/`,
        method: 'GET',
        body: {session: {blocks: [], status: 'completed'}},
      });
      const firstSendMock = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/seer/explorer-chat/${runId}/`,
        method: 'POST',
        body: {run_id: 1},
        asyncDelay: new Promise<void>(resolve => {
          settleFirstSend = resolve;
        }),
      });

      const {result} = renderHookWithProviders(() => useSeerExplorer(), {
        organization,
        additionalWrapper: SeerExplorerChatStateProvider,
      });
      act(() => {
        result.current.switchToRun(runId);
      });
      await waitFor(() => {
        expect(result.current.sessionData?.status).toBe('completed');
      });

      act(() => {
        result.current.sendMessage('First question');
      });
      await waitFor(() => {
        expect(firstSendMock).toHaveBeenCalled();
      });

      // Mocks are matched newest first, so only the second send gets the failure.
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/seer/explorer-chat/${runId}/`,
        method: 'POST',
        statusCode: 500,
        body: {detail: 'Server error'},
      });
      act(() => {
        result.current.sendMessage('Second question');
      });
      await waitFor(() => {
        expect(result.current.requestError).toEqual({query: 'Second question'});
      });

      // Let the first request succeed and its callbacks run to completion.
      await act(async () => {
        settleFirstSend();
        for (let i = 0; i < 5; i++) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      });

      expect(result.current.requestError).toEqual({query: 'Second question'});
    });

    it('clears the request error when switching conversations', async () => {
      const runId = 'run-a';
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/seer/explorer-chat/${runId}/`,
        method: 'GET',
        body: {session: {blocks: [], status: 'completed'}},
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/seer/explorer-chat/${runId}/`,
        method: 'POST',
        statusCode: 500,
        body: {detail: 'Server error'},
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/seer/explorer-chat/run-b/`,
        method: 'GET',
        body: {session: {blocks: [], status: 'completed'}},
      });

      const {result} = renderHookWithProviders(() => useSeerExplorer(), {
        organization,
        additionalWrapper: SeerExplorerChatStateProvider,
      });
      act(() => {
        result.current.switchToRun(runId);
      });
      await waitFor(() => {
        expect(result.current.sessionData?.status).toBe('completed');
      });

      act(() => {
        result.current.sendMessage('Will fail');
      });
      await waitFor(() => {
        expect(result.current.requestError).toEqual({query: 'Will fail'});
      });

      act(() => {
        result.current.switchToRun('run-b');
      });
      expect(result.current.requestError).toBeNull();

      // Coming back to the original conversation does not bring the stale error back.
      act(() => {
        result.current.switchToRun(runId);
      });
      expect(result.current.requestError).toBeNull();
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
        additionalWrapper: SeerExplorerChatStateProvider,
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
        additionalWrapper: SeerExplorerChatStateProvider,
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

    it('reads a session that carries no blocks as an empty conversation', async () => {
      // A run with no Seer state behind it (still mirroring, or failed to
      // start) comes back as a status-only session. Reading `blocks` off it
      // unguarded used to throw and take the whole page down with it.
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/seer/explorer-chat/789/`,
        method: 'GET',
        body: {session: {status: 'error'}},
      });

      const {result} = renderHookWithProviders(() => useSeerExplorer(), {
        organization,
        additionalWrapper: SeerExplorerChatStateProvider,
      });

      act(() => {
        result.current.switchToRun(789);
      });

      await waitFor(() => {
        expect(result.current.sessionData?.status).toBe('error');
      });
      expect(result.current.sessionData?.blocks).toEqual([]);
    });

    it('URL-encodes the runId when building explorer-update URLs', async () => {
      // A runId carrying path separators must be encoded so the same-origin
      // POST can't traverse to another endpoint.
      const maliciousRunId = '../../foo';
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/seer/explorer-chat/..%2F..%2Ffoo/`,
        method: 'GET',
        body: {session: {blocks: [], status: 'processing'}},
      });
      const updateMock = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/seer/explorer-update/..%2F..%2Ffoo/`,
        method: 'POST',
        body: {run_id: 123},
      });

      const {result} = renderHookWithProviders(() => useSeerExplorer(), {
        organization,
        additionalWrapper: SeerExplorerChatStateProvider,
      });

      act(() => {
        result.current.switchToRun(maliciousRunId);
      });

      await waitFor(() => {
        expect(result.current.runId).toBe(maliciousRunId);
      });

      act(() => {
        result.current.interruptRun();
      });

      await waitFor(() => {
        expect(updateMock).toHaveBeenCalled();
      });
    });

    it('flags an errored session with no blocks as a load failure', async () => {
      // Seer can hand back `{session: {status: 'error'}}` with nothing else. Without
      // this flag the panel is indistinguishable from an idle new chat.
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/seer/explorer-chat/789/`,
        method: 'GET',
        body: {session: {status: 'error'}},
      });

      const {result} = renderHookWithProviders(() => useSeerExplorer(), {
        organization,
        additionalWrapper: SeerExplorerChatStateProvider,
      });

      act(() => {
        result.current.switchToRun(789);
      });

      await waitFor(() => {
        expect(result.current.hasSessionLoadError).toBe(true);
      });
      // The request itself succeeded, so the transport-level flag stays false.
      expect(result.current.isError).toBe(false);
    });

    it('does not flag an errored session that still has blocks to show', async () => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/seer/explorer-chat/790/`,
        method: 'GET',
        body: {
          session: {
            status: 'error',
            blocks: [
              {
                id: '1',
                message: {role: 'user', content: 'Hello'},
                timestamp: '2024-01-01T00:00:00Z',
              },
            ],
          },
        },
      });

      const {result} = renderHookWithProviders(() => useSeerExplorer(), {
        organization,
        additionalWrapper: SeerExplorerChatStateProvider,
      });

      act(() => {
        result.current.switchToRun(790);
      });

      await waitFor(() => {
        expect(result.current.sessionData?.blocks).toHaveLength(1);
      });
      expect(result.current.hasSessionLoadError).toBe(false);
    });
  });

  describe('Polling Logic', () => {
    const chatUrl = `/organizations/${organization.slug}/seer/explorer-chat/`;
    const runId = 999;

    it('returns false for polling when no session exists', () => {
      const {result} = renderHookWithProviders(() => useSeerExplorer(), {
        organization,
        additionalWrapper: SeerExplorerChatStateProvider,
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
        additionalWrapper: SeerExplorerChatStateProvider,
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
        additionalWrapper: SeerExplorerChatStateProvider,
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
        additionalWrapper: SeerExplorerChatStateProvider,
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
        additionalWrapper: SeerExplorerChatStateProvider,
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
        additionalWrapper: SeerExplorerChatStateProvider,
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
        additionalWrapper: SeerExplorerChatStateProvider,
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
        additionalWrapper: SeerExplorerChatStateProvider,
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
        additionalWrapper: SeerExplorerChatStateProvider,
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
        additionalWrapper: SeerExplorerChatStateProvider,
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
        additionalWrapper: SeerExplorerChatStateProvider,
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
        additionalWrapper: SeerExplorerChatStateProvider,
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
        additionalWrapper: SeerExplorerChatStateProvider,
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
        additionalWrapper: SeerExplorerChatStateProvider,
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

      const {result} = renderHookWithProviders(() => useSeerExplorer(), {
        organization,
        additionalWrapper: SeerExplorerChatStateProvider,
      });

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

      const {result} = renderHookWithProviders(() => useSeerExplorer(), {
        organization,
        additionalWrapper: SeerExplorerChatStateProvider,
      });

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
        additionalWrapper: SeerExplorerChatStateProvider,
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
        additionalWrapper: SeerExplorerChatStateProvider,
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
        additionalWrapper: SeerExplorerChatStateProvider,
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
