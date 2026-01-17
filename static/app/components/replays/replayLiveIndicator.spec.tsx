import {act} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import {QueryClientProvider} from 'sentry/utils/queryClient';
import {OrganizationContext} from 'sentry/views/organizationContext';

import {useLiveBadge, useLiveRefresh} from './replayLiveIndicator';

jest.mock('sentry/views/replays/detail/ai/replaySummaryContext', () => ({
  useReplaySummaryContext: () => ({
    startSummaryRequest: jest.fn(),
  }),
}));

jest.mock('sentry/utils/replays/hooks/useReplayProjectSlug', () => ({
  useReplayProjectSlug: () => 'test-project',
}));

jest.useFakeTimers();

describe('useLiveBadge', () => {
  it('should return isLive=true when replay finished within 5 minutes', () => {
    const now = Date.now();
    const startedAt = new Date(now - 60_000); // 1 minute ago
    const finishedAt = new Date(now); // just now

    const {result} = renderHook(() =>
      useLiveBadge({
        startedAt,
        finishedAt,
      })
    );

    expect(result.current.isLive).toBe(true);
  });

  it('should return isLive=false when replay finished more than 5 minutes ago', () => {
    const now = Date.now();
    const startedAt = new Date(now - 10 * 60_000); // 10 minutes ago
    const finishedAt = new Date(now - 6 * 60_000); // 6 minutes ago (more than 5 min threshold)

    const {result} = renderHook(() =>
      useLiveBadge({
        startedAt,
        finishedAt,
      })
    );

    expect(result.current.isLive).toBe(false);
  });

  it('should return isLive=false when replay has expired (started more than 1 hour ago)', () => {
    const now = Date.now();
    const startedAt = new Date(now - 2 * 60 * 60_000); // 2 hours ago
    const finishedAt = new Date(now); // just now

    const {result} = renderHook(() =>
      useLiveBadge({
        startedAt,
        finishedAt,
      })
    );

    expect(result.current.isLive).toBe(false);
  });

  it('should transition from isLive=true to isLive=false after 5 minutes', async () => {
    const now = Date.now();
    const startedAt = new Date(now - 60_000); // 1 minute ago
    const finishedAt = new Date(now); // just now

    const {result} = renderHook(() =>
      useLiveBadge({
        startedAt,
        finishedAt,
      })
    );

    expect(result.current.isLive).toBe(true);

    // Advance time by 5 minutes + 1ms
    await act(async () => {
      await jest.advanceTimersByTimeAsync(5 * 60 * 1000 + 1);
    });

    expect(result.current.isLive).toBe(false);
  });

  it('should return isLive=false when finishedAt is null', () => {
    const now = Date.now();
    const startedAt = new Date(now - 60_000);

    const {result} = renderHook(() =>
      useLiveBadge({
        startedAt,
        finishedAt: null,
      })
    );

    expect(result.current.isLive).toBe(false);
  });
});

describe('useLiveRefresh', () => {
  const organization = OrganizationFixture();

  function createWrapper() {
    const queryClient = makeTestQueryClient();
    return function Wrapper({children}: {children: React.ReactNode}) {
      return (
        <QueryClientProvider client={queryClient}>
          <OrganizationContext value={organization}>{children}</OrganizationContext>
        </QueryClientProvider>
      );
    };
  }

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('should not show refresh button when replay is undefined', () => {
    const {result} = renderHook(() => useLiveRefresh({replay: undefined}), {
      wrapper: createWrapper(),
    });

    expect(result.current.shouldShowRefreshButton).toBe(false);
  });

  it('should not show refresh button initially when polled segments equals current segments', () => {
    const replay = ReplayRecordFixture({
      count_segments: 5,
    });

    // Mock the polling endpoint to return same segment count
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replays/${replay.id}/`,
      body: {data: replay},
    });

    const {result} = renderHook(() => useLiveRefresh({replay}), {
      wrapper: createWrapper(),
    });

    // Initial state - no refresh button since polled and current are equal
    expect(result.current.shouldShowRefreshButton).toBe(false);
  });

  it('should show refresh button when polled segments is greater than current segments', async () => {
    const now = Date.now();
    const replay = ReplayRecordFixture({
      started_at: new Date(now - 60_000), // 1 minute ago (not expired)
      count_segments: 5,
    });

    const updatedReplay = ReplayRecordFixture({
      ...replay,
      count_segments: 10,
    });

    // Mock the polling endpoint to return updated segment count
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replays/${replay.id}/`,
      body: {data: updatedReplay},
    });

    const {result} = renderHook(() => useLiveRefresh({replay}), {
      wrapper: createWrapper(),
    });

    // Wait for the API call to complete and state to update
    await waitFor(() => {
      expect(result.current.shouldShowRefreshButton).toBe(true);
    });
  });

  it('should not poll when replay has expired (started more than 1 hour ago)', async () => {
    const now = Date.now();
    const replay = ReplayRecordFixture({
      started_at: new Date(now - 2 * 60 * 60_000), // 2 hours ago (expired)
      count_segments: 5,
    });

    const replayEndpoint = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replays/${replay.id}/`,
      body: {data: {...replay, count_segments: 10}},
    });

    renderHook(() => useLiveRefresh({replay}), {
      wrapper: createWrapper(),
    });

    // Advance time past polling interval
    await act(async () => {
      await jest.advanceTimersByTimeAsync(30_000 + 1);
    });

    // Polling should not happen for expired replays
    expect(replayEndpoint).not.toHaveBeenCalled();
  });

  it('should provide a doRefresh function that can be called', () => {
    const now = Date.now();
    const replay = ReplayRecordFixture({
      started_at: new Date(now - 60_000),
      count_segments: 5,
    });

    const updateMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replays/${replay.id}/`,
      body: {data: replay},
    });

    const {result} = renderHook(() => useLiveRefresh({replay}), {
      wrapper: createWrapper(),
    });

    result.current.doRefresh();
    expect(updateMock).toHaveBeenCalledTimes(1);
  });
});
