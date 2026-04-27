import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {
  markSeerExplorerRead,
  useSeerExplorerUnreadCount,
} from 'sentry/views/seerExplorer/hooks/useSeerExplorerUnreadCount';

const organization = OrganizationFixture({
  features: ['seer-explorer'],
  hideAiFeatures: false,
});

const RUN_ID = 42;
const STORAGE_KEY = 'seer:explorer-last-viewed';

function setLastViewed(runId: number, ts: number) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({[String(runId)]: ts}));
}

function getLastViewed(runId: number): number {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return 0;
  const map = JSON.parse(raw) as Record<string, number>;
  return map[String(runId)] ?? 0;
}

function block(overrides: {
  id: string;
  role: 'user' | 'assistant' | 'tool_use';
  timestamp: string;
  loading?: boolean;
}) {
  return {
    id: overrides.id,
    timestamp: overrides.timestamp,
    loading: overrides.loading ?? false,
    message: {role: overrides.role, content: ''},
  };
}

function mockSession(blocks: Array<ReturnType<typeof block>>) {
  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/seer/explorer-chat/${RUN_ID}/`,
    method: 'GET',
    body: {
      session: {
        run_id: RUN_ID,
        status: 'completed',
        updated_at: '2026-04-27T00:00:00Z',
        blocks,
      },
    },
  });
}

describe('useSeerExplorerUnreadCount', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    localStorage.clear();
    sessionStorage.clear();
    sessionStorage.setItem('seer-explorer-run-id', String(RUN_ID));
  });

  it('counts only non-user, non-loading blocks newer than lastViewedAt', async () => {
    setLastViewed(RUN_ID, 1000);
    mockSession([
      block({id: 'a', role: 'user', timestamp: new Date(2000).toISOString()}),
      block({id: 'b', role: 'assistant', timestamp: new Date(500).toISOString()}),
      block({id: 'c', role: 'assistant', timestamp: new Date(2000).toISOString()}),
      block({id: 'd', role: 'tool_use', timestamp: new Date(3000).toISOString()}),
      block({
        id: 'e',
        role: 'assistant',
        timestamp: new Date(4000).toISOString(),
        loading: true,
      }),
    ]);

    const {result} = renderHookWithProviders(() => useSeerExplorerUnreadCount(true), {
      organization,
    });

    await waitFor(() => expect(result.current.unreadCount).toBe(2));
  });

  it('markAllRead drops unreadCount to 0 and persists past the latest block', async () => {
    mockSession([
      block({id: 'a', role: 'assistant', timestamp: new Date(2000).toISOString()}),
      block({id: 'b', role: 'tool_use', timestamp: new Date(3000).toISOString()}),
    ]);

    const {result} = renderHookWithProviders(() => useSeerExplorerUnreadCount(true), {
      organization,
    });

    await waitFor(() => expect(result.current.unreadCount).toBe(2));

    act(() => {
      result.current.markAllRead();
    });

    expect(result.current.unreadCount).toBe(0);
    expect(getLastViewed(RUN_ID)).toBeGreaterThanOrEqual(3000);
  });

  it('propagates markSeerExplorerRead to other hook instances via window event', async () => {
    mockSession([
      block({id: 'a', role: 'assistant', timestamp: new Date(2000).toISOString()}),
    ]);

    const {result} = renderHookWithProviders(() => useSeerExplorerUnreadCount(true), {
      organization,
    });

    await waitFor(() => expect(result.current.unreadCount).toBe(1));

    act(() => {
      markSeerExplorerRead(RUN_ID, 5000);
    });

    expect(result.current.unreadCount).toBe(0);
  });

  it('returns 0 when disabled (does not poll)', () => {
    mockSession([
      block({id: 'a', role: 'assistant', timestamp: new Date(2000).toISOString()}),
    ]);

    const {result} = renderHookWithProviders(() => useSeerExplorerUnreadCount(false), {
      organization,
    });

    expect(result.current.unreadCount).toBe(0);
  });
});
