import {initializeOrg} from 'sentry-test/initializeOrg';
import {reactHooks} from 'sentry-test/reactTestingLibrary';

import {BreadcrumbType} from 'sentry/types/breadcrumbs';
import useReplayData from 'sentry/utils/replays/hooks/useReplayData';

jest.useFakeTimers();

const {organization} = initializeOrg();
const HYDRATED_REPLAY = TestStubs.ReplayReaderParams().replayRecord;
const RAW_REPLAY = TestStubs.ReplayReaderParams({
  replayRecord: {
    duration: HYDRATED_REPLAY.duration.asMilliseconds() / 1000,
    started_at: HYDRATED_REPLAY.started_at.toString(),
    finished_at: HYDRATED_REPLAY.finished_at.toString(),
    tags: {},
  },
}).replayRecord;

const ORG_SLUG = organization.slug;
const PROJECT_SLUG = 'project-slug';
const REPLAY_ID = RAW_REPLAY.id;

const INIT_BREADCRUMB = expect.objectContaining({
  type: BreadcrumbType.INIT,
});
const END_RRWEB_EVENT = expect.objectContaining({
  type: 5, // EventType.Custom,
  data: {
    tag: 'replay-end',
  },
});

describe('useReplayData', () => {
  beforeAll(function () {
    MockApiClient.mockAsync = true;
  });

  afterAll(function () {
    MockApiClient.mockAsync = false;
  });

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('should fetch the data for a given project + replayId + org', async () => {
    const mockedReplayCall = MockApiClient.addMockResponse({
      url: `/projects/${ORG_SLUG}/${PROJECT_SLUG}/replays/${REPLAY_ID}/`,
      body: {data: RAW_REPLAY},
    });
    const mockedAttachmentsCall = MockApiClient.addMockResponse({
      url: `/organizations/${ORG_SLUG}/replays-events-meta/`,
      body: {data: []},
    });
    const mockedErrorsCall = MockApiClient.addMockResponse({
      url: `/projects/${ORG_SLUG}/${PROJECT_SLUG}/replays/${REPLAY_ID}/recording-segments/`,
      body: [],
    });

    const {result, waitForNextUpdate} = reactHooks.renderHook(useReplayData, {
      initialProps: {
        replaySlug: `${PROJECT_SLUG}:${REPLAY_ID}`,
        orgSlug: ORG_SLUG,
      },
    });

    // Immediatly we will see the replay call is made
    expect(mockedReplayCall).toHaveBeenCalledTimes(1);
    expect(mockedAttachmentsCall).not.toHaveBeenCalledTimes(1);
    expect(mockedErrorsCall).not.toHaveBeenCalledTimes(1);
    expect(result.current).toEqual({
      fetchError: undefined,
      fetching: true,
      onRetry: expect.any(Function),
      replay: null,
      replayRecord: undefined,
    });

    jest.runAllTimers();
    await waitForNextUpdate();

    // Afterwards we see the attachments & errors requests are made
    expect(mockedReplayCall).toHaveBeenCalledTimes(1);
    expect(mockedAttachmentsCall).toHaveBeenCalledTimes(1);
    expect(mockedErrorsCall).toHaveBeenCalledTimes(1);
    expect(result.current).toEqual({
      fetchError: undefined,
      fetching: true,
      onRetry: expect.any(Function),
      replay: expect.objectContaining({
        replayRecord: HYDRATED_REPLAY,
        rrwebEvents: expect.arrayContaining([END_RRWEB_EVENT]),
        breadcrumbs: expect.arrayContaining([INIT_BREADCRUMB]),
        consoleCrumbs: [],
        networkSpans: [],
        memorySpans: [],
      }),
      replayRecord: HYDRATED_REPLAY,
    });

    jest.runAllTimers();
    await waitForNextUpdate();

    // Finally we see fetching is complete
    expect(mockedReplayCall).toHaveBeenCalledTimes(1);
    expect(mockedAttachmentsCall).toHaveBeenCalledTimes(1);
    expect(mockedErrorsCall).toHaveBeenCalledTimes(1);
    expect(result.current).toEqual({
      fetchError: undefined,
      fetching: false,
      onRetry: expect.any(Function),
      replay: expect.objectContaining({
        replayRecord: HYDRATED_REPLAY,
        rrwebEvents: expect.arrayContaining([END_RRWEB_EVENT]),
        breadcrumbs: expect.arrayContaining([INIT_BREADCRUMB]),
        consoleCrumbs: [],
        networkSpans: [],
        memorySpans: [],
      }),
      replayRecord: HYDRATED_REPLAY,
    });
  });
});
