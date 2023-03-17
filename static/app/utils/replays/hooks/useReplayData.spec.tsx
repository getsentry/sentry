import {duration} from 'moment';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {reactHooks} from 'sentry-test/reactTestingLibrary';

import useReplayData from 'sentry/utils/replays/hooks/useReplayData';
import ReplayReader from 'sentry/utils/replays/replayReader';
import type {ReplayRecord} from 'sentry/views/replays/types';

jest.useFakeTimers();
jest.spyOn(ReplayReader, 'factory');

const {organization, project} = initializeOrg();

const MockedReplayReaderFactory = ReplayReader.factory as jest.MockedFunction<
  typeof ReplayReader.factory
>;

function getMockReplayRecord(replayRecord?: Partial<ReplayRecord>) {
  const HYDRATED_REPLAY = TestStubs.ReplayRecord(replayRecord);
  const RAW_REPLAY = {
    ...HYDRATED_REPLAY,
    duration: HYDRATED_REPLAY.duration.asMilliseconds() / 1000,
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
      url: `/projects/${organization.slug}/${project.slug}/replays/${mockReplayResponse.id}/`,
      body: {data: mockReplayResponse},
    });

    const {result, waitForNextUpdate} = reactHooks.renderHook(useReplayData, {
      initialProps: {
        replaySlug: `${project.slug}:${mockReplayResponse.id}`,
        orgSlug: organization.slug,
      },
    });

    await waitForNextUpdate();

    expect(result.current).toEqual({
      fetchError: undefined,
      fetching: false,
      onRetry: expect.any(Function),
      replay: expect.any(ReplayReader),
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

    const mockSegmentResponse1 = TestStubs.ReplaySegmentInit({timestamp: startedAt});
    const mockSegmentResponse2 = [
      ...TestStubs.ReplaySegmentConsole({timestamp: startedAt}),
      ...TestStubs.ReplaySegmentNavigation({timestamp: startedAt}),
    ];

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/replays/${mockReplayResponse.id}/`,
      body: {data: mockReplayResponse},
    });
    const mockedSegmentsCall1 = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/replays/${mockReplayResponse.id}/recording-segments/`,
      body: mockSegmentResponse1,
      match: [(_url, options) => options.query?.cursor === '1:0:1'],
    });
    const mockedSegmentsCall2 = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/replays/${mockReplayResponse.id}/recording-segments/`,
      body: mockSegmentResponse2,
      match: [(_url, options) => options.query?.cursor === '1:1:0'],
    });

    const {waitForNextUpdate} = reactHooks.renderHook(useReplayData, {
      initialProps: {
        replaySlug: `${project.slug}:${mockReplayResponse.id}`,
        orgSlug: organization.slug,
        segmentsPerPage: 1,
      },
    });

    jest.runAllTimers();
    await waitForNextUpdate();

    expect(mockedSegmentsCall1).toHaveBeenCalledTimes(1);
    expect(mockedSegmentsCall2).toHaveBeenCalledTimes(1);

    expect(MockedReplayReaderFactory).toHaveBeenLastCalledWith({
      attachments: [...mockSegmentResponse1, ...mockSegmentResponse2],
      replayRecord: expectedReplay,
      errors: [],
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
      count_errors: 2,
      count_segments: 0,
      error_ids: ERROR_IDS,
    });

    const mockErrorResponse1 = [
      TestStubs.ReplayError({
        id: ERROR_IDS[0],
        issue: 'JAVASCRIPT-123E',
        timestamp: startedAt,
      }),
    ];
    const mockErrorResponse2 = [
      TestStubs.ReplayError({
        id: ERROR_IDS[1],
        issue: 'JAVASCRIPT-789Z',
        timestamp: startedAt,
      }),
    ];

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/replays/${mockReplayResponse.id}/`,
      body: {data: mockReplayResponse},
    });
    const mockedErrorsCall1 = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replays-events-meta/`,
      body: {data: mockErrorResponse1},
      match: [(_url, options) => options.query?.query === `id:[${ERROR_IDS[0]}]`],
    });
    const mockedErrorsCall2 = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replays-events-meta/`,
      body: {data: mockErrorResponse2},
      match: [(_url, options) => options.query?.query === `id:[${ERROR_IDS[1]}]`],
    });

    const {waitForNextUpdate} = reactHooks.renderHook(useReplayData, {
      initialProps: {
        replaySlug: `${project.slug}:${mockReplayResponse.id}`,
        orgSlug: organization.slug,
        errorsPerPage: 1,
      },
    });

    jest.runAllTimers();
    await waitForNextUpdate();

    expect(mockedErrorsCall1).toHaveBeenCalledTimes(1);
    expect(mockedErrorsCall2).toHaveBeenCalledTimes(1);

    expect(MockedReplayReaderFactory).toHaveBeenLastCalledWith({
      attachments: [],
      replayRecord: expectedReplay,
      errors: [...mockErrorResponse1, ...mockErrorResponse2],
    });
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
    const mockSegmentResponse = TestStubs.ReplaySegmentInit({timestamp: startedAt});
    const mockErrorResponse = [
      TestStubs.ReplayError({
        id: ERROR_ID,
        issue: 'JAVASCRIPT-123E',
        timestamp: startedAt,
      }),
    ];

    const mockedReplayCall = MockApiClient.addMockResponse({
      asyncDelay: 1,
      url: `/projects/${organization.slug}/${project.slug}/replays/${mockReplayResponse.id}/`,
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
        replaySlug: `${project.slug}:${mockReplayResponse.id}`,
        orgSlug: organization.slug,
      },
    });

    const expectedReplayData = {
      fetchError: undefined,
      fetching: true,
      onRetry: expect.any(Function),
      replay: null,
      replayRecord: undefined,
    } as Record<string, unknown>;

    // Immediately we will see the replay call is made
    expect(mockedReplayCall).toHaveBeenCalledTimes(1);
    expect(mockedEventsMetaCall).not.toHaveBeenCalledTimes(1);
    expect(mockedSegmentsCall).not.toHaveBeenCalledTimes(1);
    expect(MockedReplayReaderFactory).toHaveBeenLastCalledWith({
      attachments: [],
      replayRecord: undefined,
      errors: [],
    });
    expect(result.current).toEqual(expectedReplayData);

    jest.advanceTimersByTime(10);
    await waitForNextUpdate();

    // Afterwards we see the attachments & errors requests are made
    expect(mockedReplayCall).toHaveBeenCalledTimes(1);
    expect(mockedEventsMetaCall).toHaveBeenCalledTimes(1);
    expect(mockedSegmentsCall).toHaveBeenCalledTimes(1);
    expect(MockedReplayReaderFactory).toHaveBeenLastCalledWith({
      attachments: [],
      replayRecord: expectedReplay,
      errors: [],
    });
    expectedReplayData.replayRecord = expectedReplay;
    expectedReplayData.replay = expect.any(ReplayReader);
    expect(result.current).toEqual(expectedReplayData);

    jest.advanceTimersByTime(100);
    await waitForNextUpdate();

    // Next we see that some rrweb data has arrived
    expect(MockedReplayReaderFactory).toHaveBeenLastCalledWith({
      attachments: mockSegmentResponse,
      replayRecord: expectedReplay,
      errors: [],
    });

    jest.advanceTimersByTime(250);
    await waitForNextUpdate();

    // Finally we see fetching is complete, errors are here too
    expect(MockedReplayReaderFactory).toHaveBeenLastCalledWith({
      attachments: mockSegmentResponse,
      replayRecord: expectedReplay,
      errors: mockErrorResponse,
    });
  });
});
