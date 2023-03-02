import {initializeOrg} from 'sentry-test/initializeOrg';
import {reactHooks} from 'sentry-test/reactTestingLibrary';

import {BreadcrumbType} from 'sentry/types/breadcrumbs';
import useReplayData from 'sentry/utils/replays/hooks/useReplayData';
import {ReplayError} from 'sentry/views/replays/types';

jest.useFakeTimers();

const {organization} = initializeOrg();
const replayReaderParams = TestStubs.ReplayReaderParams();
const HYDRATED_REPLAY = replayReaderParams.replayRecord;
const RAW_REPLAY = TestStubs.ReplayReaderParams({
  replayRecord: {
    duration: HYDRATED_REPLAY.duration.asMilliseconds() / 1000,
    started_at: HYDRATED_REPLAY.started_at.toString(),
    finished_at: HYDRATED_REPLAY.finished_at.toString(),
    tags: {},
  },
}).replayRecord;
const MOCK_ATTACHMENTS = replayReaderParams.attachments;
const MOCK_ERRORS: ReplayError[] = [
  {
    'error.type': [] as string[],
    'error.value': [] as string[],
    id: '1d50320db4a2423cb15e63b905ca69ea',
    issue: 'JAVASCRIPT-123E',
    'issue.id': 3740335939,
    'project.name': 'javascript',
    timestamp: '2023-01-01T10:23:16+00:00',
    title: 'ARedirect with :orgId param on customer domain',
  },
];

const ORG_SLUG = organization.slug;
const PROJECT_SLUG = 'project-slug';
const REPLAY_ID = RAW_REPLAY.id;

const EXPECT_INIT_RRWEB_EVENT = expect.objectContaining({
  type: 0,
});

const EXPECT_END_RRWEB_EVENT = expect.objectContaining({
  type: 5, // EventType.Custom,
  data: expect.objectContaining({
    tag: 'replay-end',
  }),
});

const EXPECT_REPLAY_INIT = expect.objectContaining({
  type: BreadcrumbType.INIT,
  data: expect.objectContaining({
    action: 'replay-init',
    label: 'Start recording',
  }),
});

const EXPECT_ISSUE_CRUMB = expect.objectContaining({
  category: 'issue',
  description: 'Error',
  data: expect.objectContaining({
    groupShortId: 'JAVASCRIPT-123E',
  }),
});

describe('useReplayData', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('should fetch the data for a given project + replayId + org', async () => {
    const mockedReplayCall = MockApiClient.addMockResponse(
      {
        url: `/projects/${ORG_SLUG}/${PROJECT_SLUG}/replays/${REPLAY_ID}/`,
        body: {data: RAW_REPLAY},
      },
      {asyncDelay: 1}
    );

    const mockedSegmentsCall = MockApiClient.addMockResponse(
      {
        url: `/projects/${ORG_SLUG}/${PROJECT_SLUG}/replays/${REPLAY_ID}/recording-segments/`,
        body: MOCK_ATTACHMENTS,
      },
      {asyncDelay: 100} // Simulate 100ms response time
    );

    const mockedEventsMetaCall = MockApiClient.addMockResponse(
      {
        url: `/organizations/${ORG_SLUG}/replays-events-meta/`,
        body: {data: MOCK_ERRORS},
      },
      {asyncDelay: 250} // Simulate 250ms response time
    );

    const {result, waitForNextUpdate} = reactHooks.renderHook(useReplayData, {
      initialProps: {
        replaySlug: `${PROJECT_SLUG}:${REPLAY_ID}`,
        orgSlug: ORG_SLUG,
      },
    });

    // Immediately we will see the replay call is made
    expect(mockedReplayCall).toHaveBeenCalledTimes(1);
    expect(mockedEventsMetaCall).not.toHaveBeenCalledTimes(1);
    expect(mockedSegmentsCall).not.toHaveBeenCalledTimes(1);
    expect(result.current).toEqual({
      fetchError: undefined,
      fetching: true,
      onRetry: expect.any(Function),
      replay: null,
      replayRecord: undefined,
    });

    jest.advanceTimersByTime(10);
    await waitForNextUpdate();

    // Afterwards we see the attachments & errors requests are made, no data has arrived
    expect(mockedReplayCall).toHaveBeenCalledTimes(1);
    expect(mockedEventsMetaCall).toHaveBeenCalledTimes(1);
    expect(mockedSegmentsCall).toHaveBeenCalledTimes(1);
    expect(result.current).toEqual({
      fetchError: undefined,
      fetching: true,
      onRetry: expect.any(Function),
      replay: expect.objectContaining({
        replayRecord: HYDRATED_REPLAY,
        rrwebEvents: [EXPECT_END_RRWEB_EVENT],
        breadcrumbs: [EXPECT_REPLAY_INIT],
        consoleCrumbs: [],
        networkSpans: [],
        memorySpans: [],
      }),
      replayRecord: HYDRATED_REPLAY,
    });

    jest.advanceTimersByTime(100);
    await waitForNextUpdate();

    // Next we see that some rrweb data has arrived
    expect(result.current).toEqual(
      expect.objectContaining({
        fetching: true,
        replay: expect.objectContaining({
          rrwebEvents: expect.arrayContaining([
            EXPECT_INIT_RRWEB_EVENT,
            EXPECT_END_RRWEB_EVENT,
          ]),
          breadcrumbs: [EXPECT_REPLAY_INIT],
          consoleCrumbs: [],
        }),
      })
    );

    jest.advanceTimersByTime(250);
    await waitForNextUpdate();

    // Finally we see fetching is complete, errors are here too
    expect(result.current).toEqual(
      expect.objectContaining({
        fetching: false,
        replay: expect.objectContaining({
          rrwebEvents: expect.arrayContaining([
            EXPECT_INIT_RRWEB_EVENT,
            EXPECT_END_RRWEB_EVENT,
          ]),
          breadcrumbs: [EXPECT_REPLAY_INIT, EXPECT_ISSUE_CRUMB],
          consoleCrumbs: [EXPECT_ISSUE_CRUMB],
        }),
      })
    );
  });
});
