import {act, type ReactNode} from 'react';
import {duration} from 'moment-timezone';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {
  ReplayConsoleEventFixture,
  ReplayNavigateEventFixture,
} from 'sentry-fixture/replay/helpers';
import {RRWebInitFrameEventsFixture} from 'sentry-fixture/replay/rrweb';
import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {makeTestQueryClient} from 'sentry-test/queryClient';
import {render, renderHook, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {QueryClientProvider} from 'sentry/utils/queryClient';
import useLoadReplayReader from 'sentry/utils/replays/hooks/useLoadReplayReader';
import {OrganizationContext} from 'sentry/views/organizationContext';
import ReplayDetailsUserBadge from 'sentry/views/replays/detail/header/replayDetailsUserBadge';
import type {HydratedReplayRecord} from 'sentry/views/replays/types';

const {organization, project} = initializeOrg({
  organization: OrganizationFixture({}),
});

const mockInvalidateQueries = jest.fn();

function wrapper({children}: {children?: ReactNode}) {
  const queryClient = makeTestQueryClient();
  queryClient.invalidateQueries = mockInvalidateQueries;
  return (
    <QueryClientProvider client={queryClient}>
      <OrganizationContext value={organization}>{children}</OrganizationContext>
    </QueryClientProvider>
  );
}

function replayRecordFixture(replayRecord?: Partial<HydratedReplayRecord>) {
  return ReplayRecordFixture({
    ...replayRecord,
    project_id: project.id,
  });
}

jest.useFakeTimers();
describe('replayDetailsUserBadge', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    mockInvalidateQueries.mockClear();
  });
  it('should not show refresh button on initial render', async () => {
    const replayRecord = replayRecordFixture({count_segments: 100});
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replays/${replayRecord.id}/`,
      body: {data: replayRecord},
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replays-events-meta/`,
      body: {
        data: [],
      },
      headers: {
        Link: [
          '<http://localhost/?cursor=0:0:1>; rel="previous"; results="false"; cursor="0:1:0"',
          '<http://localhost/?cursor=0:2:0>; rel="next"; results="false"; cursor="0:1:0"',
        ].join(','),
      },
    });

    const {result} = renderHook(useLoadReplayReader, {
      wrapper,
      initialProps: {
        orgSlug: organization.slug,
        replaySlug: `${project.slug}:${replayRecord.id}`,
      },
    });

    await waitFor(() =>
      expect(result.current.replayRecord?.count_segments).toBeDefined()
    );

    render(<ReplayDetailsUserBadge readerResult={result.current} />);
    expect(screen.queryByTestId('refresh-button')).not.toBeVisible();
  });

  it('should show refresh button when replay record is outdated', async () => {
    const now = Date.now();
    const STARTED_AT = new Date(now - 10 * 1000);
    const FINISHED_AT_FIVE_SECONDS = new Date(now - 5 * 1000);
    const FINISHED_AT_TEN_SECONDS = new Date(now);

    const replayRecord = replayRecordFixture({
      started_at: STARTED_AT,
      finished_at: FINISHED_AT_FIVE_SECONDS,
      duration: duration(5, 'seconds'),
      count_errors: 0,
      count_segments: 1,
      error_ids: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replays/${replayRecord.id}/`,
      body: {data: replayRecord},
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replays-events-meta/`,
      body: {
        data: [],
      },
      headers: {
        Link: [
          '<http://localhost/?cursor=0:0:1>; rel="previous"; results="false"; cursor="0:1:0"',
          '<http://localhost/?cursor=0:2:0>; rel="next"; results="false"; cursor="0:1:0"',
        ].join(','),
      },
    });

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/replays/${replayRecord.id}/recording-segments/`,
      body: [
        RRWebInitFrameEventsFixture({
          timestamp: STARTED_AT,
        }),
        ReplayConsoleEventFixture({timestamp: STARTED_AT}),
      ],
      match: [(_url, options) => options.query?.cursor === '0:0:0'],
    });

    const {result} = renderHook(useLoadReplayReader, {
      wrapper,
      initialProps: {
        orgSlug: organization.slug,
        replaySlug: `${project.slug}:${replayRecord.id}`,
      },
    });

    await waitFor(() =>
      expect(result.current.replayRecord?.count_segments).toBeDefined()
    );

    render(<ReplayDetailsUserBadge readerResult={result.current} />, {organization});

    expect(screen.queryByTestId('refresh-button')).not.toBeVisible();

    const updatedReplayRecord = replayRecordFixture({
      started_at: STARTED_AT,
      finished_at: FINISHED_AT_TEN_SECONDS,
      duration: duration(10, 'seconds'),
      count_errors: 0,
      count_segments: 2,
      error_ids: [],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replays/${updatedReplayRecord.id}/`,
      body: {data: updatedReplayRecord},
    });

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/replays/${updatedReplayRecord.id}/recording-segments/`,
      body: [
        RRWebInitFrameEventsFixture({
          timestamp: STARTED_AT,
        }),
        ReplayConsoleEventFixture({timestamp: STARTED_AT}),
        ReplayNavigateEventFixture({
          startTimestamp: STARTED_AT,
          endTimestamp: FINISHED_AT_TEN_SECONDS,
        }),
      ],
      match: [(_url, options) => options.query?.cursor === '0:0:0'],
    });

    await act(async () => {
      // advance to next polling interval
      await jest.advanceTimersByTimeAsync(1000 * 30 + 1);
    });

    expect(screen.queryByTestId('refresh-button')).toBeVisible();
  });

  it('should show LIVE badge when last received segment is within 5 minutes', async () => {
    const startedAt = new Date(Date.now() - 1000);
    const finishedAt = new Date(Date.now());

    const replayRecord = replayRecordFixture({
      started_at: startedAt,
      finished_at: finishedAt,
      count_errors: 0,
      count_segments: 1,
      error_ids: [],
    });
    const replayRecordEndpoint = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replays/${replayRecord.id}/`,
      body: {data: replayRecord},
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replays-events-meta/`,
      body: {
        data: [],
      },
      headers: {
        Link: [
          '<http://localhost/?cursor=0:0:1>; rel="previous"; results="false"; cursor="0:1:0"',
          '<http://localhost/?cursor=0:2:0>; rel="next"; results="false"; cursor="0:1:0"',
        ].join(','),
      },
    });

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/replays/${replayRecord.id}/recording-segments/`,
      body: [
        RRWebInitFrameEventsFixture({
          timestamp: startedAt,
        }),
      ],
      match: [(_url, options) => options.query?.cursor === '0:0:0'],
    });

    const {result} = renderHook(useLoadReplayReader, {
      wrapper,
      initialProps: {
        orgSlug: organization.slug,
        replaySlug: `${project.slug}:${replayRecord.id}`,
      },
    });

    await waitFor(() =>
      expect(result.current.replayRecord?.count_segments).toBeDefined()
    );

    render(<ReplayDetailsUserBadge readerResult={result.current} />, {organization});

    await waitFor(() => expect(replayRecordEndpoint).toHaveBeenCalledTimes(2));
    expect(screen.queryByTestId('live-badge')).toBeVisible();
  });

  it('should hide LIVE badge when last received segment is more than 5 minutes ago', async () => {
    const now = Date.now();
    const startedAt = new Date(now - 1000);
    const finishedAt = new Date(now);

    const replayRecord = replayRecordFixture({
      started_at: startedAt,
      finished_at: finishedAt,
      duration: duration(1, 'seconds'),
      count_errors: 0,
      count_segments: 1,
      error_ids: [],
    });
    const replayRecordEndpoint = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replays/${replayRecord.id}/`,
      body: {data: replayRecord},
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replays-events-meta/`,
      body: {
        data: [],
      },
      headers: {
        Link: [
          '<http://localhost/?cursor=0:0:1>; rel="previous"; results="false"; cursor="0:1:0"',
          '<http://localhost/?cursor=0:2:0>; rel="next"; results="false"; cursor="0:1:0"',
        ].join(','),
      },
    });

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/replays/${replayRecord.id}/recording-segments/`,
      body: [
        RRWebInitFrameEventsFixture({
          timestamp: startedAt,
        }),
        ReplayNavigateEventFixture({
          startTimestamp: startedAt,
          endTimestamp: finishedAt,
        }),
      ],
      match: [(_url, options) => options.query?.cursor === '0:0:0'],
    });

    const {result} = renderHook(useLoadReplayReader, {
      wrapper,
      initialProps: {
        orgSlug: organization.slug,
        replaySlug: `${project.slug}:${replayRecord.id}`,
      },
    });

    // useLoadReplayReader calls this endpoint
    await waitFor(() => expect(replayRecordEndpoint).toHaveBeenCalledTimes(1));

    await waitFor(() =>
      expect(result.current.replayRecord?.count_segments).toBeDefined()
    );

    render(<ReplayDetailsUserBadge readerResult={result.current} />, {organization});

    // usePollReplayRecord calls this endpoint
    await waitFor(() => expect(replayRecordEndpoint).toHaveBeenCalledTimes(2));
    expect(screen.queryByTestId('live-badge')).toBeVisible();

    // let 5 minutes and 1/1000 second pass
    await act(async () => jest.advanceTimersByTimeAsync(5 * 60 * 1000 + 1));

    expect(screen.queryByTestId('live-badge')).not.toBeInTheDocument();
  });

  it('should cause useLoadReplayReader to refetch when the refresh button is pressed', async () => {
    const queryClient = makeTestQueryClient();
    queryClient.invalidateQueries = mockInvalidateQueries;

    function sharedQueryClientWrapper({children}: {children?: ReactNode}) {
      return (
        <QueryClientProvider client={queryClient}>
          <OrganizationContext value={organization}>{children}</OrganizationContext>
        </QueryClientProvider>
      );
    }
    const now = Date.now();
    const STARTED_AT = new Date(now - 10 * 1000);
    const FINISHED_AT_FIVE_SECONDS = new Date(now - 5 * 1000);
    const FINISHED_AT_TEN_SECONDS = new Date(now);

    const replayRecord = replayRecordFixture({
      started_at: STARTED_AT,
      finished_at: FINISHED_AT_FIVE_SECONDS,
      duration: duration(5, 'seconds'),
      count_errors: 0,
      count_segments: 1,
      error_ids: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replays/${replayRecord.id}/`,
      body: {data: replayRecord},
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replays-events-meta/`,
      body: {
        data: [],
      },
      headers: {
        Link: [
          '<http://localhost/?cursor=0:0:1>; rel="previous"; results="false"; cursor="0:1:0"',
          '<http://localhost/?cursor=0:2:0>; rel="next"; results="false"; cursor="0:1:0"',
        ].join(','),
      },
    });

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/replays/${replayRecord.id}/recording-segments/`,
      body: [
        RRWebInitFrameEventsFixture({
          timestamp: STARTED_AT,
        }),
        ReplayConsoleEventFixture({timestamp: STARTED_AT}),
      ],
      match: [(_url, options) => options.query?.cursor === '0:0:0'],
    });

    const {result} = await act(() =>
      renderHook(useLoadReplayReader, {
        wrapper: sharedQueryClientWrapper,
        initialProps: {
          orgSlug: organization.slug,
          replaySlug: `${project.slug}:${replayRecord.id}`,
        },
      })
    );

    await waitFor(() =>
      expect(result.current.replayRecord?.count_segments).toBeDefined()
    );

    act(() =>
      render(
        sharedQueryClientWrapper({
          children: <ReplayDetailsUserBadge readerResult={result.current} />,
        }),
        {
          organization,
        }
      )
    );

    expect(screen.queryByTestId('refresh-button')).not.toBeVisible();

    const updatedReplayRecord = replayRecordFixture({
      started_at: STARTED_AT,
      finished_at: FINISHED_AT_TEN_SECONDS,
      duration: duration(10, 'seconds'),
      count_errors: 0,
      count_segments: 2,
      error_ids: [],
    });

    const updatedReplayRecordEndpoint = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replays/${updatedReplayRecord.id}/`,
      body: {data: updatedReplayRecord},
    });

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/replays/${updatedReplayRecord.id}/recording-segments/`,
      body: [
        RRWebInitFrameEventsFixture({
          timestamp: STARTED_AT,
        }),
        ReplayConsoleEventFixture({timestamp: STARTED_AT}),
        ReplayNavigateEventFixture({
          startTimestamp: STARTED_AT,
          endTimestamp: FINISHED_AT_TEN_SECONDS,
        }),
      ],
      match: [(_url, options) => options.query?.cursor === '0:0:0'],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replays-events-meta/`,
      body: {
        data: [],
      },
      headers: {
        Link: [
          '<http://localhost/?cursor=0:0:1>; rel="previous"; results="false"; cursor="0:1:0"',
          '<http://localhost/?cursor=0:2:0>; rel="next"; results="false"; cursor="0:1:0"',
        ].join(','),
      },
    });

    await act(async () => {
      // advance to next polling interval
      await jest.advanceTimersByTimeAsync(1000 * 30 + 1);
    });

    await waitFor(() => expect(updatedReplayRecordEndpoint).toHaveBeenCalledTimes(1));

    act(() => {
      screen.queryByTestId('refresh-button')?.click();
    });

    expect(updatedReplayRecordEndpoint).toHaveBeenCalledTimes(2);

    await waitFor(() =>
      expect(result.current.replayRecord?.finished_at).toEqual(FINISHED_AT_TEN_SECONDS)
    );
  });
});
