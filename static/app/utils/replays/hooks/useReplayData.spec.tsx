import {duration} from 'moment-timezone';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {RawReplayErrorFixture} from 'sentry-fixture/replay/error';
import {
  ReplayConsoleEventFixture,
  ReplayNavigateEventFixture,
} from 'sentry-fixture/replay/helpers';
import {RRWebInitFrameEventsFixture} from 'sentry-fixture/replay/rrweb';
import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import useReplayData from 'sentry/utils/replays/hooks/useReplayData';
import type {HydratedReplayRecord} from 'sentry/views/replays/types';

const organization = OrganizationFixture();
const project = ProjectFixture();

function getMockReplayRecord(replayRecord?: Partial<HydratedReplayRecord>) {
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
    ProjectsStore.loadInitialData([project]);
    MockApiClient.clearMockResponses();
  });

  it('should hydrate the replayRecord', async () => {
    const {mockReplayResponse, expectedReplay} = getMockReplayRecord({
      count_errors: 0,
      count_segments: 0,
      error_ids: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replays/${mockReplayResponse.id}/`,
      body: {data: mockReplayResponse},
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

    const {result} = renderHookWithProviders(useReplayData, {
      initialProps: {
        replayId: mockReplayResponse.id,
        orgSlug: organization.slug,
      },
    });

    await waitFor(() =>
      expect(result.current).toEqual({
        attachments: expect.any(Array),
        errors: expect.any(Array),
        feedbackEvents: expect.any(Array),
        fetchError: undefined,
        isError: false,
        isPending: false,
        onRetry: expect.any(Function),
        projectSlug: project.slug,
        replayRecord: expectedReplay,
        status: 'success',
      })
    );
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

    const mockSegmentResponse1 = RRWebInitFrameEventsFixture({
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

    const {result} = renderHookWithProviders(useReplayData, {
      initialProps: {
        replayId: mockReplayResponse.id,
        orgSlug: organization.slug,
        segmentsPerPage: 1,
      },
    });

    await waitFor(() => expect(mockedSegmentsCall1).toHaveBeenCalledTimes(1));
    expect(mockedSegmentsCall2).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(result.current).toStrictEqual(
        expect.objectContaining({
          attachments: [...mockSegmentResponse1, ...mockSegmentResponse2],
          errors: [],
          replayRecord: expectedReplay,
        })
      );
    });
  });

  it('should always fetch DISCOVER & ISSUE_PLATFORM errors', async () => {
    const startedAt = new Date('12:00:00 01-01-2023');
    const finishedAt = new Date('12:00:10 01-01-2023');

    const {mockReplayResponse, expectedReplay} = getMockReplayRecord({
      started_at: startedAt,
      finished_at: finishedAt,
      duration: duration(10, 'seconds'),
      count_errors: 0,
      count_segments: 0,
      error_ids: [],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replays/${mockReplayResponse.id}/`,
      body: {data: mockReplayResponse},
    });
    const mockedErrorEventsMetaCall = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replays-events-meta/`,
      body: {},
      headers: {
        Link: [
          '<http://localhost/?cursor=0:0:1>; rel="previous"; results="false"; cursor="0:0:1"',
          '<http://localhost/?cursor=0:2:0>; rel="next"; results="false"; cursor="0:1:0"',
        ].join(','),
      },
      match: [
        (_url, options) => options.query?.dataset === DiscoverDatasets.DISCOVER,
        (_url, options) => options.query?.query === `replayId:[${mockReplayResponse.id}]`,
        (_url, options) => options.query?.cursor === '0:0:0',
      ],
    });

    const mockedIssuePlatformEventsMetaCall = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replays-events-meta/`,
      body: {},
      headers: {
        Link: [
          '<http://localhost/?cursor=0:0:1>; rel="previous"; results="false"; cursor="0:0:1"',
          '<http://localhost/?cursor=0:2:0>; rel="next"; results="false"; cursor="0:1:0"',
        ].join(','),
      },
      match: [
        (_url, options) => options.query?.dataset === DiscoverDatasets.ISSUE_PLATFORM,
        (_url, options) => options.query?.query === `replayId:[${mockReplayResponse.id}]`,
        (_url, options) => options.query?.cursor === '0:0:0',
      ],
    });

    const {result} = renderHookWithProviders(useReplayData, {
      initialProps: {
        replayId: mockReplayResponse.id,
        orgSlug: organization.slug,
        errorsPerPage: 1,
      },
    });

    await waitFor(() => expect(mockedErrorEventsMetaCall).toHaveBeenCalledTimes(1));
    expect(mockedIssuePlatformEventsMetaCall).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(result.current).toStrictEqual(
        expect.objectContaining({
          attachments: [],
          errors: [],
          replayRecord: expectedReplay,
        })
      );
    });
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
      count_errors: ERROR_IDS.length,
      count_segments: 0,
      error_ids: ERROR_IDS,
    });

    const mockErrorResponse1 = [
      RawReplayErrorFixture({
        id: ERROR_IDS[0]!,
        issue: 'JAVASCRIPT-123E',
        timestamp: startedAt,
      }),
    ];
    const mockErrorResponse2 = [
      RawReplayErrorFixture({
        id: ERROR_IDS[1]!,
        issue: 'JAVASCRIPT-789Z',
        timestamp: startedAt,
      }),
    ];
    const mockErrorResponse3 = [
      RawReplayErrorFixture({
        id: ERROR_IDS[0]!,
        issue: 'JAVASCRIPT-123E',
        timestamp: startedAt,
      }),
    ];
    const mockErrorResponse4 = [
      RawReplayErrorFixture({
        id: ERROR_IDS[1]!,
        issue: 'JAVASCRIPT-789Z',
        timestamp: startedAt,
      }),
    ];

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replays/${mockReplayResponse.id}/`,
      body: {data: mockReplayResponse},
    });
    const mockedErrorEventsMetaCall1 = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replays-events-meta/`,
      body: {data: mockErrorResponse1},
      headers: {
        Link: [
          '<http://localhost/?cursor=0:0:1>; rel="previous"; results="false"; cursor="0:0:1"',
          '<http://localhost/?cursor=0:2:0>; rel="next"; results="true"; cursor="0:1:0"',
        ].join(','),
      },
      match: [
        (_url, options) => options.query?.dataset === DiscoverDatasets.DISCOVER,
        (_url, options) => options.query?.query === `replayId:[${mockReplayResponse.id}]`,
        (_url, options) => options.query?.cursor === '0:0:0',
      ],
    });
    const mockedErrorEventsMetaCall2 = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replays-events-meta/`,
      body: {data: mockErrorResponse2},
      headers: {
        Link: [
          '<http://localhost/?cursor=0:0:1>; rel="previous"; results="true"; cursor="0:1:0"',
          '<http://localhost/?cursor=0:2:0>; rel="next"; results="false"; cursor="0:2:0"',
        ].join(','),
      },
      match: [
        (_url, options) => options.query?.dataset === DiscoverDatasets.DISCOVER,
        (_url, options) => options.query?.query === `replayId:[${mockReplayResponse.id}]`,
        (_url, options) => options.query?.cursor === '0:1:0',
      ],
    });
    const mockedIssuePlatformEventsMetaCall1 = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replays-events-meta/`,
      body: {data: mockErrorResponse3},
      headers: {
        Link: [
          '<http://localhost/?cursor=0:0:1>; rel="previous"; results="false"; cursor="0:0:1"',
          '<http://localhost/?cursor=0:2:0>; rel="next"; results="true"; cursor="0:1:0"',
        ].join(','),
      },
      match: [
        (_url, options) => options.query?.dataset === DiscoverDatasets.ISSUE_PLATFORM,
        (_url, options) => options.query?.query === `replayId:[${mockReplayResponse.id}]`,
        (_url, options) => options.query?.cursor === '0:0:0',
      ],
    });
    const mockedIssuePlatformEventsMetaCall2 = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replays-events-meta/`,
      body: {data: mockErrorResponse4},
      headers: {
        Link: [
          '<http://localhost/?cursor=0:0:1>; rel="previous"; results="true"; cursor="0:1:0"',
          '<http://localhost/?cursor=0:2:0>; rel="next"; results="false"; cursor="0:2:0"',
        ].join(','),
      },
      match: [
        (_url, options) => options.query?.dataset === DiscoverDatasets.ISSUE_PLATFORM,
        (_url, options) => options.query?.query === `replayId:[${mockReplayResponse.id}]`,
        (_url, options) => options.query?.cursor === '0:1:0',
      ],
    });

    const {result} = renderHookWithProviders(useReplayData, {
      initialProps: {
        replayId: mockReplayResponse.id,
        orgSlug: organization.slug,
        errorsPerPage: 1,
      },
    });

    await waitFor(() => expect(mockedErrorEventsMetaCall1).toHaveBeenCalledTimes(1));
    expect(mockedErrorEventsMetaCall2).toHaveBeenCalledTimes(1);
    expect(mockedIssuePlatformEventsMetaCall1).toHaveBeenCalledTimes(1);
    expect(mockedIssuePlatformEventsMetaCall2).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(result.current).toStrictEqual(
        expect.objectContaining({
          attachments: [],
          errors: [
            ...mockErrorResponse1,
            ...mockErrorResponse2,
            ...mockErrorResponse3,
            ...mockErrorResponse4,
          ],
          replayRecord: expectedReplay,
        })
      );
    });
  });

  it('should incrementally load attachments and errors', async () => {
    const ERROR_IDS = ['5c83aaccfffb4a708ae893bad9be3a1c'];
    const startedAt = new Date('12:00:00 01-01-2023');
    const finishedAt = new Date('12:00:10 01-01-2023');

    const {mockReplayResponse, expectedReplay} = getMockReplayRecord({
      started_at: startedAt,
      finished_at: finishedAt,
      duration: duration(10, 'seconds'),
      count_errors: ERROR_IDS.length,
      count_segments: 1,
      error_ids: ERROR_IDS,
    });
    const mockSegmentResponse = RRWebInitFrameEventsFixture({
      timestamp: startedAt,
    });
    const mockErrorResponse = [
      RawReplayErrorFixture({
        id: ERROR_IDS[0]!,
        issue: 'JAVASCRIPT-123E',
        timestamp: startedAt,
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

    const mockedErrorEventsMetaCall = MockApiClient.addMockResponse({
      asyncDelay: 250, // Simulate 250ms response time
      url: `/organizations/${organization.slug}/replays-events-meta/`,
      match: [MockApiClient.matchQuery({dataset: DiscoverDatasets.DISCOVER})],
      body: {data: mockErrorResponse},
    });
    const mockedIssuePlatformEventsMetaCall = MockApiClient.addMockResponse({
      asyncDelay: 250, // Simulate 250ms response time
      url: `/organizations/${organization.slug}/replays-events-meta/`,
      match: [MockApiClient.matchQuery({dataset: DiscoverDatasets.ISSUE_PLATFORM})],
      body: {data: mockErrorResponse},
    });

    const {result} = renderHookWithProviders(useReplayData, {
      initialProps: {
        replayId: mockReplayResponse.id,
        orgSlug: organization.slug,
      },
    });

    const expectedReplayData = {
      attachments: [],
      errors: [],
      feedbackEvents: [],
      fetchError: undefined,
      isError: true,
      isPending: true,
      onRetry: expect.any(Function),
      projectSlug: null,
      replayRecord: undefined,
      status: 'error',
    } as Record<string, unknown>;

    // Immediately we will see the replay call is made
    expect(mockedReplayCall).toHaveBeenCalledTimes(1);
    expect(mockedErrorEventsMetaCall).not.toHaveBeenCalled();
    expect(mockedIssuePlatformEventsMetaCall).not.toHaveBeenCalled();
    expect(mockedSegmentsCall).not.toHaveBeenCalled();
    expect(result.current).toEqual(expectedReplayData);

    // Afterwards we see the attachments & errors requests are made
    await waitFor(() => expect(mockedReplayCall).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockedErrorEventsMetaCall).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(mockedIssuePlatformEventsMetaCall).toHaveBeenCalledTimes(1)
    );
    expect(mockedSegmentsCall).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(result.current).toStrictEqual(
        expect.objectContaining({
          attachments: [],
          errors: [],
          projectSlug: project.slug,
          replayRecord: expectedReplay,
        })
      )
    );

    // Next we see that some rrweb data has arrived
    await waitFor(() =>
      expect(result.current).toStrictEqual(
        expect.objectContaining({
          attachments: mockSegmentResponse,
          errors: [],
          replayRecord: expectedReplay,
        })
      )
    );

    // Finally we see fetching is complete, errors are here too
    await waitFor(() =>
      expect(result.current).toStrictEqual(
        expect.objectContaining({
          attachments: mockSegmentResponse,
          // mockErrorResponse is the same between both responses
          errors: [...mockErrorResponse, ...mockErrorResponse],
          replayRecord: expectedReplay,
        })
      )
    );
  });

  it("should invalidate queries when result's 'onRetry' function is called", async () => {
    const {mockReplayResponse} = getMockReplayRecord({
      count_errors: 0,
      count_segments: 0,
      error_ids: [],
    });

    const replayId = mockReplayResponse.id;

    const mockedReplayCall = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replays/${replayId}/`,
      body: {data: mockReplayResponse},
    });

    const mockedErrorEventsMetaCall = MockApiClient.addMockResponse({
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

    const {result} = renderHookWithProviders(useReplayData, {
      initialProps: {
        replayId,
        orgSlug: organization.slug,
      },
    });

    // We need this 'await waitFor()' for the following assertions to pass:
    await waitFor(() => {
      expect(result.current).toBeTruthy();
    });

    await waitFor(() => {
      expect(mockedReplayCall).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(mockedErrorEventsMetaCall).toHaveBeenCalledTimes(2);
    });

    result.current.onRetry();

    await waitFor(() => {
      expect(mockedReplayCall).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(mockedErrorEventsMetaCall).toHaveBeenCalledTimes(2);
    });
  });
});
