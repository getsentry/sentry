import {act} from 'react';
import {QueryClientProvider} from '@tanstack/react-query';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import {OrganizationContext} from 'sentry/utils/organizationContext';
import {
  replayAttachmentsApiOptions,
  replayRecordApiOptions,
} from 'sentry/utils/replays/hooks/useReplayData';
import type {ReplayRecord} from 'sentry/views/explore/replays/types';

import {useLiveBadge, useLiveRefresh} from './replayLiveIndicator';

jest.mock('sentry/views/explore/replays/detail/ai/replaySummaryContext', () => ({
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

  it('should stop polling in real time once the 1-hour window elapses while mounted', async () => {
    const now = Date.now();
    const replay = ReplayRecordFixture({
      started_at: new Date(now - 59 * 60_000), // expires in 1 minute
      count_segments: 5,
    });

    const replayEndpoint = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replays/${replay.id}/`,
      body: {data: {...replay, count_segments: 5}},
    });

    renderHook(() => useLiveRefresh({replay}), {wrapper: createWrapper()});

    // Poll at least once before the expiry window closes.
    await act(async () => {
      await jest.advanceTimersByTimeAsync(30_000 + 1);
    });

    // Advance past the 1-hour boundary, then two more polling intervals.
    await act(async () => {
      await jest.advanceTimersByTimeAsync(90_000);
    });
    const callsAtExpiry = replayEndpoint.mock.calls.length;

    await act(async () => {
      await jest.advanceTimersByTimeAsync(60_000);
    });

    // No further polls once the replay expires.
    expect(replayEndpoint.mock.calls).toHaveLength(callsAtExpiry);
  });

  it('should not poll archived replays (null started_at)', async () => {
    // Archived replays have a null start time; treat them as expired.
    const replay = {
      ...ReplayRecordFixture({count_segments: 5}),
      started_at: null,
    } as unknown as ReplayRecord;

    const replayEndpoint = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replays/${replay.id}/`,
      body: {data: {...replay, count_segments: 10}},
    });

    renderHook(() => useLiveRefresh({replay}), {wrapper: createWrapper()});

    await act(async () => {
      await jest.advanceTimersByTimeAsync(30_000 + 1);
    });

    expect(replayEndpoint).not.toHaveBeenCalled();
  });

  it('should resume polling when the replay switches from expired to live', async () => {
    const now = Date.now();
    const expiredReplay = ReplayRecordFixture({
      id: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      started_at: new Date(now - 2 * 60 * 60_000), // expired
      count_segments: 5,
    });
    const liveReplay = ReplayRecordFixture({
      id: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      started_at: new Date(now - 60_000), // live
      count_segments: 5,
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replays/${liveReplay.id}/`,
      body: {data: {...liveReplay, count_segments: 20}},
    });
    const expiredEndpoint = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replays/${expiredReplay.id}/`,
      body: {data: {...expiredReplay, count_segments: 5}},
    });

    const {result, rerender} = renderHook(({replay}) => useLiveRefresh({replay}), {
      wrapper: createWrapper(),
      initialProps: {replay: expiredReplay},
    });

    // Page from the expired replay to a live one without remounting the hook.
    rerender({replay: liveReplay});

    await act(async () => {
      await jest.advanceTimersByTimeAsync(30_000 + 1);
    });

    await waitFor(() => {
      expect(result.current.shouldShowRefreshButton).toBe(true);
    });
    expect(expiredEndpoint).not.toHaveBeenCalled();
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

  it('doRefresh invalidates replay record and segments queries', async () => {
    const now = Date.now();
    const replay = ReplayRecordFixture({
      started_at: new Date(now - 60_000),
      count_segments: 5,
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replays/${replay.id}/`,
      body: {data: replay},
    });

    const queryClient = makeTestQueryClient();

    function Wrapper({children}: {children: React.ReactNode}) {
      return (
        <QueryClientProvider client={queryClient}>
          <OrganizationContext value={organization}>{children}</OrganizationContext>
        </QueryClientProvider>
      );
    }

    const replayOptions = replayRecordApiOptions({
      organizationIdOrSlug: organization.slug,
      replayId: replay.id,
    });
    const segmentsOptions = replayAttachmentsApiOptions({
      organizationIdOrSlug: organization.slug,
      projectIdOrSlug: 'test-project',
      replayId: replay.id,
    });

    queryClient.setQueryData(replayOptions.queryKey, {json: {data: replay}, headers: {}});
    queryClient.setQueryData(segmentsOptions.queryKey, {json: [], headers: {}});

    const {result} = renderHook(() => useLiveRefresh({replay}), {wrapper: Wrapper});

    await act(async () => {
      await result.current.doRefresh();
    });

    expect(queryClient.getQueryState(replayOptions.queryKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(segmentsOptions.queryKey)?.isInvalidated).toBe(true);
  });
});
