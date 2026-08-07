import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {useSeerExplorerPolling} from './useSeerExplorerPolling';

/**
 * conduit-client owns the EventSource lifecycle, which jsdom can't drive. Mock
 * `useStream` so tests can deliver messages directly and assert on what the hook
 * does with them.
 *
 * These drive `useSeerExplorerPolling` rather than `useSeerExplorerStream`
 * directly, because the two only work as a pair: the stream hook writes into and
 * invalidates a query whose observer lives in the polling hook. Invalidating
 * without that observer is a no-op, so testing the stream hook alone would assert
 * on a wiring that doesn't exist in production.
 */
const streamHandlers: {
  current: {
    enabled?: boolean;
    onClose?: () => void;
    onConnect?: () => void;
    onError?: (e: Error) => void;
    onMessage?: (msg: any) => void;
  };
} = {current: {}};

jest.mock('conduit-client', () => ({
  useStream: (options: any) => {
    streamHandlers.current = options;
    return {isConnected: false, error: null};
  },
}));

const BASE_FEATURES = ['seer-explorer', 'gen-ai-features'];

function makeSession(content: string) {
  return {
    session: {
      blocks: [
        {
          id: 'block-1',
          message: {role: 'assistant', content},
          timestamp: '2026-01-01T00:00:00Z',
          loading: true,
        },
      ],
      status: 'processing',
      updated_at: new Date().toISOString(),
    },
  };
}

describe('useSeerExplorerStream', () => {
  const organization = OrganizationFixture({
    features: [...BASE_FEATURES, 'seer-explorer-conduit'],
    hideAiFeatures: false,
    openMembership: true,
  });

  let sessionMock: jest.Mock;

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    streamHandlers.current = {};
    sessionMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/explorer-chat/42/`,
      body: makeSession('Hello'),
    });
  });

  function render(org = organization) {
    return renderHookWithProviders(() => useSeerExplorerPolling({runId: 42}), {
      organization: org,
    });
  }

  const connect = () =>
    act(() => {
      streamHandlers.current.onConnect?.();
    });

  const send = (message: Record<string, unknown>) =>
    act(() => {
      streamHandlers.current.onMessage?.(message);
    });

  /** Let the debounced invalidate and any refetch settle. */
  const settle = () => act(() => new Promise(resolve => setTimeout(resolve, 300)));

  describe('enablement', () => {
    it('opens the stream when the org has the feature', async () => {
      render();

      await waitFor(() => expect(streamHandlers.current.enabled).toBe(true));
    });

    it('stays closed without the feature', async () => {
      const org = OrganizationFixture({
        features: BASE_FEATURES,
        hideAiFeatures: false,
        openMembership: true,
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${org.slug}/seer/explorer-chat/42/`,
        body: makeSession('Hello'),
      });

      render(org);

      await waitFor(() => expect(streamHandlers.current.enabled).toBe(false));
    });
  });

  describe('text deltas', () => {
    it('appends without a network request', async () => {
      // The whole point of streaming: text lands as a local cache write.
      const {result} = render();
      await waitFor(() => expect(result.current.apiData).toBeDefined());
      connect();
      await settle();
      const callsBefore = sessionMock.mock.calls.length;

      send({kind: 'text', block_id: 'block-1', text: ' world', offset: 0});
      await settle();

      expect(result.current.apiData?.session?.blocks[0]?.message.content).toBe(
        'Hello world'
      );
      expect(sessionMock.mock.calls).toHaveLength(callsBefore);
    });

    it('appends consecutive deltas in order', async () => {
      const {result} = render();
      await waitFor(() => expect(result.current.apiData).toBeDefined());
      connect();
      await settle();

      send({kind: 'text', block_id: 'block-1', text: ' one', offset: 0});
      send({kind: 'text', block_id: 'block-1', text: ' two', offset: 4});
      await settle();

      expect(result.current.apiData?.session?.blocks[0]?.message.content).toBe(
        'Hello one two'
      );
    });

    it('refetches rather than render a gap when an offset does not line up', async () => {
      // A dropped delta must degrade to a redundant fetch, never to text with an
      // invisible hole in it.
      const {result} = render();
      await waitFor(() => expect(result.current.apiData).toBeDefined());
      connect();
      await settle();
      const callsBefore = sessionMock.mock.calls.length;

      send({kind: 'text', block_id: 'block-1', text: ' world', offset: 999});
      await settle();

      expect(sessionMock.mock.calls.length).toBeGreaterThan(callsBefore);
      expect(result.current.apiData?.session?.blocks[0]?.message.content).toBe('Hello');
    });

    it('refetches when a delta arrives for an unknown block', async () => {
      // Blocks arrive via the state endpoint, so a delta can outrun its block.
      const {result} = render();
      await waitFor(() => expect(result.current.apiData).toBeDefined());
      connect();
      await settle();
      const callsBefore = sessionMock.mock.calls.length;

      send({kind: 'text', block_id: 'nonexistent', text: 'hi', offset: 0});
      await settle();

      expect(sessionMock.mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });

  describe('nudges', () => {
    it('refetches on invalidate', async () => {
      const {result} = render();
      await waitFor(() => expect(result.current.apiData).toBeDefined());
      connect();
      await settle();
      const callsBefore = sessionMock.mock.calls.length;

      send({kind: 'invalidate', reason: 'tool_call'});
      await settle();

      expect(sessionMock.mock.calls.length).toBeGreaterThan(callsBefore);
    });

    it('refetches on an unrecognized kind', async () => {
      // Forward compatible: a newer Seer may publish kinds this build predates,
      // and "go look again" is always a safe response.
      const {result} = render();
      await waitFor(() => expect(result.current.apiData).toBeDefined());
      connect();
      await settle();
      const callsBefore = sessionMock.mock.calls.length;

      send({kind: 'something-new'});
      await settle();

      expect(sessionMock.mock.calls.length).toBeGreaterThan(callsBefore);
    });

    it('collapses a burst into a single refetch', async () => {
      const {result} = render();
      await waitFor(() => expect(result.current.apiData).toBeDefined());
      connect();
      await settle();
      const callsBefore = sessionMock.mock.calls.length;

      for (let i = 0; i < 5; i++) {
        send({kind: 'invalidate', reason: 'tool_call'});
      }
      await settle();

      expect(sessionMock.mock.calls).toHaveLength(callsBefore + 1);
    });
  });

  describe('fallback to polling', () => {
    it('polls at the safety-net interval while streaming', async () => {
      // Not zero requests: a slow poll makes "the stream silently stalled"
      // impossible to experience as a frozen UI.
      const {result} = render();
      await waitFor(() => expect(result.current.apiData).toBeDefined());
      connect();
      await settle();
      const callsBefore = sessionMock.mock.calls.length;

      // Well past the 500ms poll interval, nowhere near the 15s safety net.
      await settle();
      await settle();

      expect(sessionMock.mock.calls).toHaveLength(callsBefore);
      expect(result.current.isPolling).toBe(true);
    });

    it('resumes fast polling after the stream errors', async () => {
      // A dead stream must not leave the UI on the 15s safety-net cadence: the
      // disconnect refetch is also what makes React Query recompute the interval.
      const {result} = render();
      await waitFor(() => expect(result.current.apiData).toBeDefined());
      connect();
      await settle();
      const callsBefore = sessionMock.mock.calls.length;

      act(() => {
        streamHandlers.current.onError?.(new Error('connection lost'));
      });
      // Long enough for the 500ms poll to fire, but far short of the 15s safety
      // net -- so a second fetch here can only mean fast polling resumed.
      await act(() => new Promise(resolve => setTimeout(resolve, 900)));

      expect(sessionMock.mock.calls.length).toBeGreaterThan(callsBefore + 1);
    });

    it('resyncs on connect, since the stream replays history', async () => {
      const {result} = render();
      await waitFor(() => expect(result.current.apiData).toBeDefined());
      await settle();
      const callsBefore = sessionMock.mock.calls.length;

      connect();
      await settle();

      expect(sessionMock.mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });
});
