import {duration} from 'moment';
import {
  ReplayConsoleEventFixture,
  ReplayNavigateEventFixture,
} from 'sentry-fixture/replay/helpers';
import {RRWebInitFrameEvents} from 'sentry-fixture/replay/rrweb';
import {ReplayErrorFixture} from 'sentry-fixture/replayError';
import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {reactHooks} from 'sentry-test/reactTestingLibrary';

import useReplayData from 'sentry/utils/replays/hooks/useReplayData';
import useProjects from 'sentry/utils/useProjects';
import type {ReplayRecord} from 'sentry/views/replays/types';

jest.useFakeTimers();
jest.mock('sentry/utils/useProjects');

const {organization, project} = initializeOrg();

jest.mocked(useProjects).mockReturnValue({
  fetching: false,
  projects: [project],
  fetchError: null,
  hasMore: false,
  initiallyLoaded: true,
  onSearch: () => Promise.resolve(),
  placeholders: [],
});

function getMockReplayRecord(replayRecord?: Partial<ReplayRecord>) {
  const HYDRATED_REPLAY = ReplayRecordFixture({
    ...replayRecord,
    project_id: project.id,
  });
  const RAW_REPLAY = {
    ...HYDRATED_REPLAY,
    duration: HYDRATED_REPLAY.duration.asSeconds(),
    started_at: HYDRATED_REPLAY.started_at.toString(),
    finished_at: HYDRATED_REPLAY.finished_at.toString(),
  };

  return {
    mockReplayResponse: RAW_REPLAY,
    expectedReplay: HYDRATED_REPLAY,
  };
}

describe('useReplayData', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('should hydrate the replayRecord', async () => {
    const {mockReplayResponse, expectedReplay} = getMockReplayRecord({
      count_errors: 0,
      count_segments: 0,
      error_ids: [],
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
      url: `/organizations/${organization.slug}/replays/${mockReplayResponse.id}/`,
      body: {data: mockReplayResponse},
    });

    const {result, waitForNextUpdate} = reactHooks.renderHook(useReplayData, {
      initialProps: {
        replayId: mockReplayResponse.id,
        orgSlug: organization.slug,
      },
    });

    await waitForNextUpdate();

    expect(result.current).toEqual({
      attachments: expect.any(Array),
      errors: expect.any(Array),
      fetchError: undefined,
      fetching: false,
      onRetry: expect.any(Function),
      projectSlug: project.slug,
      replayRecord: expectedReplay,
    });
  });

  it('should concat N segment responses and pass them into ReplayReader', async () => {
    const startedAt = new Date('12:00:00 01-01-2023');
    const finishedAt = new Date('12:00:10 01-01-2023');

    const {mockReplayResponse, expectedReplay} = getMockReplayRecord({
      started_at: startedAt,
      finished_at: finishedAt,
      duration: duration(10, 'seconds'),
      count_errors: 0,
      count_segments: 2,
      error_ids: [],
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

    const mockSegmentResponse1 = RRWebInitFrameEvents({
      timestamp: startedAt,
    });
    const mockSegmentResponse2 = [
      ReplayConsoleEventFixture({timestamp: startedAt}),
      ReplayNavigateEventFixture({
        startTimestamp: startedAt,
        endTimestamp: finishedAt,
      }),
    ];

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replays/${mockReplayResponse.id}/`,
      body: {data: mockReplayResponse},
    });
    const mockedSegmentsCall1 = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/replays/${mockReplayResponse.id}/recording-segments/`,
      body: mockSegmentResponse1,
      match: [(_url, options) => options.query?.cursor === '0:0:0'],
    });
    const mockedSegmentsCall2 = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/replays/${mockReplayResponse.id}/recording-segments/`,
      body: mockSegmentResponse2,
      match: [(_url, options) => options.query?.cursor === '0:1:0'],
    });

    const {result, waitForNextUpdate} = reactHooks.renderHook(useReplayData, {
      initialProps: {
        replayId: mockReplayResponse.id,
        orgSlug: organization.slug,
        segmentsPerPage: 1,
      },
    });

    jest.runAllTimers();
    await waitForNextUpdate();

    expect(mockedSegmentsCall1).toHaveBeenCalledTimes(1);
    expect(mockedSegmentsCall2).toHaveBeenCalledTimes(1);

    expect(result.current).toStrictEqual(
      expect.objectContaining({
        attachments: [...mockSegmentResponse1, ...mockSegmentResponse2],
        errors: [],
        replayRecord: expectedReplay,
      })
    );
  });

  it('should concat N error responses and pass them through to Replay Reader', async () => {
    const ERROR_IDS = [
      '5c83aaccfffb4a708ae893bad9be3a1c',
      '6d94aaccfffb4a708ae893bad9be3a1c',
    ];
    const startedAt = new Date('12:00:00 01-01-2023');
    const finishedAt = new Date('12:00:10 01-01-2023');

    const {mockReplayResponse, expectedReplay} = getMockReplayRecord({
      started_at: startedAt,
      finished_at: finishedAt,
      duration: duration(10, 'seconds'),
      count_errors: 2,
      count_segments: 0,
      error_ids: ERROR_IDS,
    });

    const mockErrorResponse1 = [
      ReplayErrorFixture({
        id: ERROR_IDS[0],
        issue: 'JAVASCRIPT-123E',
        timestamp: startedAt.toISOString(),
      }),
    ];
    const mockErrorResponse2 = [
      ReplayErrorFixture({
        id: ERROR_IDS[1],
        issue: 'JAVASCRIPT-789Z',
        timestamp: startedAt.toISOString(),
      }),
    ];

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replays/${mockReplayResponse.id}/`,
      body: {data: mockReplayResponse},
    });
    const mockedErrorsCall1 = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replays-events-meta/`,
      body: {data: mockErrorResponse1},
      headers: {
        Link: [
          '<http://localhost/?cursor=0:0:1>; rel="previous"; results="false"; cursor="0:0:1"',
          '<http://localhost/?cursor=0:2:0>; rel="next"; results="true"; cursor="0:1:0"',
        ].join(','),
      },
      match: [
        (_url, options) => options.query?.query === `replayId:[${mockReplayResponse.id}]`,
        (_url, options) => options.query?.cursor === '0:0:0',
      ],
    });
    const mockedErrorsCall2 = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replays-events-meta/`,
      body: {data: mockErrorResponse2},
      headers: {
        Link: [
          '<http://localhost/?cursor=0:0:1>; rel="previous"; results="true"; cursor="0:1:0"',
          '<http://localhost/?cursor=0:2:0>; rel="next"; results="false"; cursor="0:2:0"',
        ].join(','),
      },
      match: [
        (_url, options) => options.query?.query === `replayId:[${mockReplayResponse.id}]`,
        (_url, options) => options.query?.cursor === '0:1:0',
      ],
    });

    const {result, waitForNextUpdate} = reactHooks.renderHook(useReplayData, {
      initialProps: {
        replayId: mockReplayResponse.id,
        orgSlug: organization.slug,
        errorsPerPage: 1,
      },
    });

    jest.runAllTimers();
    await waitForNextUpdate();

    expect(mockedErrorsCall1).toHaveBeenCalledTimes(1);
    expect(mockedErrorsCall2).toHaveBeenCalledTimes(1);

    expect(result.current).toStrictEqual(
      expect.objectContaining({
        attachments: [],
        errors: [...mockErrorResponse1, ...mockErrorResponse2],
        replayRecord: expectedReplay,
      })
    );
  });

  it('should incrementally load attachments and errors', async () => {
    const ERROR_ID = '5c83aaccfffb4a708ae893bad9be3a1c';
    const startedAt = new Date('12:00:00 01-01-2023');
    const finishedAt = new Date('12:00:10 01-01-2023');

    const {mockReplayResponse, expectedReplay} = getMockReplayRecord({
      started_at: startedAt,
      finished_at: finishedAt,
      duration: duration(10, 'seconds'),
      count_errors: 1,
      count_segments: 1,
      error_ids: [ERROR_ID],
    });
    const mockSegmentResponse = RRWebInitFrameEvents({
      timestamp: startedAt,
    });
    const mockErrorResponse = [
      ReplayErrorFixture({
        id: ERROR_ID,
        issue: 'JAVASCRIPT-123E',
        timestamp: startedAt.toISOString(),
      }),
    ];

    const mockedReplayCall = MockApiClient.addMockResponse({
      asyncDelay: 1,
      url: `/organizations/${organization.slug}/replays/${mockReplayResponse.id}/`,
      body: {data: mockReplayResponse},
    });

    const mockedSegmentsCall = MockApiClient.addMockResponse({
      asyncDelay: 100, // Simulate 100ms response time
      url: `/projects/${organization.slug}/${project.slug}/replays/${mockReplayResponse.id}/recording-segments/`,
      body: mockSegmentResponse,
    });

    const mockedEventsMetaCall = MockApiClient.addMockResponse({
      asyncDelay: 250, // Simulate 250ms response time
      url: `/organizations/${organization.slug}/replays-events-meta/`,
      body: {data: mockErrorResponse},
    });

    const {result, waitForNextUpdate} = reactHooks.renderHook(useReplayData, {
      initialProps: {
        replayId: mockReplayResponse.id,
        orgSlug: organization.slug,
      },
    });

    const expectedReplayData = {
      attachments: [],
      errors: [],
      fetchError: undefined,
      fetching: true,
      onRetry: expect.any(Function),
      projectSlug: null,
      replayRecord: undefined,
    } as Record<string, unknown>;

    // Immediately we will see the replay call is made
    expect(mockedReplayCall).toHaveBeenCalledTimes(1);
    expect(mockedEventsMetaCall).not.toHaveBeenCalledTimes(1);
    expect(mockedSegmentsCall).not.toHaveBeenCalledTimes(1);
    expect(result.current).toEqual(expectedReplayData);

    jest.advanceTimersByTime(10);
    await waitForNextUpdate();

    // Afterwards we see the attachments & errors requests are made
    expect(mockedReplayCall).toHaveBeenCalledTimes(1);
    expect(mockedEventsMetaCall).toHaveBeenCalledTimes(1);
    expect(mockedSegmentsCall).toHaveBeenCalledTimes(1);
    expect(result.current).toStrictEqual(
      expect.objectContaining({
        attachments: [],
        errors: [],
        projectSlug: project.slug,
        replayRecord: expectedReplay,
      })
    );

    jest.advanceTimersByTime(100);
    await waitForNextUpdate();

    // Next we see that some rrweb data has arrived
    expect(result.current).toStrictEqual(
      expect.objectContaining({
        attachments: mockSegmentResponse,
        errors: [],
        replayRecord: expectedReplay,
      })
    );

    jest.advanceTimersByTime(250);
    await waitForNextUpdate();

    // Finally we see fetching is complete, errors are here too
    expect(result.current).toStrictEqual(
      expect.objectContaining({
        attachments: mockSegmentResponse,
        errors: mockErrorResponse,
        replayRecord: expectedReplay,
      })
    );
  });
});
