import {act} from 'react';
import {duration} from 'moment-timezone';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ReplayNavigateEventFixture} from 'sentry-fixture/replay/helpers';
import {RRWebInitFrameEventsFixture} from 'sentry-fixture/replay/rrweb';
import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  renderHookWithProviders,
  screen,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';
import {useLoadReplayReader} from 'sentry/utils/replays/hooks/useLoadReplayReader';
import {ReplayDetailsEntityHeader} from 'sentry/views/explore/replays/detail/header/replayDetailsEntityHeader';
import type {HydratedReplayRecord} from 'sentry/views/explore/replays/types';

const {organization, project} = initializeOrg({
  organization: OrganizationFixture({}),
});

function replayRecordFixture(replayRecord?: Partial<HydratedReplayRecord>) {
  return ReplayRecordFixture({
    ...replayRecord,
    project_id: project.id,
  });
}

jest.useFakeTimers();
describe('ReplayDetailsEntityHeader', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      body: [project],
    });
    ProjectsStore.loadInitialData([project]);
  });

  afterEach(() => {
    ProjectsStore.reset();
  });

  function mockViewedBy(replayId: string) {
    return MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/replays/${replayId}/viewed-by/`,
      body: {data: {viewed_by: []}},
    });
  }

  it('shows the archived header through the same precedence as the body', () => {
    const replayRecord = {...replayRecordFixture(), is_archived: true};

    render(
      <ReplayDetailsEntityHeader
        readerResult={
          {
            replayRecord,
            errors: [],
            replay: null,
            isPending: false,
            fetchError: undefined,
            attachmentError: undefined,
          } as unknown as ReturnType<typeof useLoadReplayReader>
        }
      />
    );

    // Routed by ReplayLoadingState rather than an early return, so the header
    // and the body below it cannot disagree about which state won.
    expect(
      screen.getByRole('heading', {name: 'Session replay, Deleted Replay'})
    ).toBeInTheDocument();
  });

  it('reads viewers from the project slug, the key useMarkReplayViewed refetches', async () => {
    const replayRecord = replayRecordFixture();
    const viewedBy = mockViewedBy(replayRecord.id);

    render(
      <ReplayDetailsEntityHeader
        readerResult={
          {
            replayRecord,
            errors: [],
            replay: null,
            isPending: false,
            fetchError: undefined,
            attachmentError: undefined,
          } as unknown as ReturnType<typeof useLoadReplayReader>
        }
      />,
      {organization}
    );

    // Keyed on the id instead, this request would still reach the same
    // endpoint but under a query key the mutation's refetch cannot match, so
    // the stack would not pick up the current user after they watch.
    await waitFor(() => expect(viewedBy).toHaveBeenCalled());
  });

  it('holds the stats while the reader is still pending', () => {
    const replayRecord = replayRecordFixture({count_dead_clicks: 1});
    mockViewedBy(replayRecord.id);

    render(
      <ReplayDetailsEntityHeader
        readerResult={
          {
            replayRecord,
            errors: [],
            // The window ReplayLoadingState routes to renderLoading: the
            // record has landed, attachments and errors have not.
            replay: null,
            isPending: true,
            fetchError: undefined,
            attachmentError: undefined,
          } as unknown as ReturnType<typeof useLoadReplayReader>
        }
      />,
      {organization}
    );

    // The title comes off the record, so it is live.
    expect(screen.getByRole('heading', {name: /Replay user/})).toBeInTheDocument();

    // The counts do not. Asserting them here would show "0 Errors" before the
    // error pages land, and the click stats on a replay that has none.
    expect(screen.queryByRole('link', {name: /Errors/})).not.toBeInTheDocument();
    expect(screen.queryByRole('link', {name: /Dead Clicks/})).not.toBeInTheDocument();
    expect(screen.getByRole('banner')).toHaveAttribute('aria-busy', 'true');
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
    mockViewedBy(replayRecord.id);
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replays/${replayRecord.id}/`,
      body: {data: replayRecord},
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
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

    const {result} = renderHookWithProviders(useLoadReplayReader, {
      organization,
      initialProps: {
        orgSlug: organization.slug,
        replaySlug: `${project.slug}:${replayRecord.id}`,
      },
    });

    await waitFor(() =>
      expect(result.current.replayRecord?.count_segments).toBeDefined()
    );

    render(<ReplayDetailsEntityHeader readerResult={result.current} />, {organization});

    expect(screen.getByText('Live')).toBeVisible();
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
    mockViewedBy(replayRecord.id);
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replays/${replayRecord.id}/`,
      body: {data: replayRecord},
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
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

    const {result} = renderHookWithProviders(useLoadReplayReader, {
      organization,
      initialProps: {
        orgSlug: organization.slug,
        replaySlug: `${project.slug}:${replayRecord.id}`,
      },
    });

    await waitFor(() =>
      expect(result.current.replayRecord?.count_segments).toBeDefined()
    );

    render(<ReplayDetailsEntityHeader readerResult={result.current} />, {organization});

    // Live badge should be visible initially
    expect(screen.getByText('Live')).toBeVisible();

    // let 5 minutes and 1/1000 second pass
    await act(async () => jest.advanceTimersByTimeAsync(5 * 60 * 1000 + 1));

    expect(screen.queryByText('Live')).not.toBeInTheDocument();
  });
});
