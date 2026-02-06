import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import useProjectFromId from 'sentry/utils/useProjectFromId';
import {
  ReplaySummaryStatus,
  ReplaySummaryTemp,
} from 'sentry/views/replays/detail/ai/utils';

import {useReplaySummary} from './useReplaySummary';

jest.mock('sentry/utils/replays/playback/providers/replayReaderProvider');
jest.mock('sentry/utils/useProjectFromId');

const mockUseProjectFromId = jest.mocked(useProjectFromId);

describe('useReplaySummary', () => {
  let mockReplay: any;
  let mockReplayRecord: any;
  let mockProject: any;
  let mockOrganization: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockReplayRecord = {
      id: 'replay-123',
      count_segments: 1,
    };
    mockReplay = {
      getReplay: jest.fn().mockReturnValue(mockReplayRecord),
    };
    mockOrganization = OrganizationFixture();
    mockProject = ProjectFixture({
      slug: 'test-project',
    });

    mockUseProjectFromId.mockReturnValue(mockProject);
  });

  describe('basic functionality', () => {
    it('should fetch summary data successfully', async () => {
      const mockSummaryData = {
        status: ReplaySummaryStatus.COMPLETED,
        data: {
          summary: 'This is a test summary',
          time_ranges: [{start: 0, end: 1000}],
        },
      };

      const mockRequest = MockApiClient.addMockResponse({
        url: `/projects/${mockOrganization.slug}/${mockProject.slug}/replays/replay-123/summarize/`,
        body: mockSummaryData,
      });

      const {result} = renderHookWithProviders(useReplaySummary, {
        organization: mockOrganization,
        initialProps: mockReplay,
      });

      await waitFor(() => {
        expect(result.current.summaryData).toEqual(mockSummaryData);
      });
      expect(result.current.isPending).toBe(false);
      expect(result.current.isError).toBe(false);
      expect(mockRequest).toHaveBeenCalledTimes(1);
    });

    it('should handle GET error gracefully, and keep pending/polling', async () => {
      const mockGet = MockApiClient.addMockResponse({
        url: `/projects/${mockOrganization.slug}/${mockProject.slug}/replays/replay-123/summarize/`,
        statusCode: 500,
        body: {detail: 'Internal server error'},
      });
      const {result} = renderHookWithProviders(useReplaySummary, {
        organization: mockOrganization,
        initialProps: mockReplay,
      });

      await waitFor(() => {
        expect(mockGet).toHaveBeenCalledTimes(1);
      });
      expect(result.current.isError).toBe(false);
      expect(result.current.isPending).toBe(true);
    });
  });

  describe('enabled option', () => {
    it('should not make API calls when disabled', () => {
      const mockRequest = MockApiClient.addMockResponse({
        url: `/projects/${mockOrganization.slug}/${mockProject.slug}/replays/replay-123/summarize/`,
        body: {
          status: ReplaySummaryStatus.COMPLETED,
          data: {summary: 'This is a test summary'},
        },
      });

      const {result} = renderHookWithProviders(
        // eslint-disable-next-line @sentry/no-renderHook-arrow-function
        () => useReplaySummary(mockReplay, {enabled: false, staleTime: 0}),
        {
          organization: mockOrganization,
        }
      );

      // The hook should not make API calls when disabled
      expect(result.current.summaryData).toBeUndefined();
      expect(result.current.isError).toBe(false);
      expect(mockRequest).not.toHaveBeenCalled();
    });

    it('should make API calls when enabled', async () => {
      MockApiClient.addMockResponse({
        url: `/projects/${mockOrganization.slug}/${mockProject.slug}/replays/replay-123/summarize/`,
        body: {
          status: ReplaySummaryStatus.COMPLETED,
          data: {summary: 'This is a test summary'},
        },
      });

      const {result} = renderHookWithProviders(
        // eslint-disable-next-line @sentry/no-renderHook-arrow-function
        () => useReplaySummary(mockReplay, {enabled: true, staleTime: 0}),
        {
          organization: mockOrganization,
        }
      );

      await waitFor(() => {
        expect(result.current.summaryData).toBeDefined();
      });
      expect(result.current.isPending).toBe(false);
      expect(result.current.isError).toBe(false);
    });

    it('should be pending when summary data is pending', async () => {
      // Mock the GET to hang
      let resolveResponse: (value?: any) => void;
      const responsePromise = new Promise(resolve => {
        resolveResponse = resolve;
      });
      const mockGet = MockApiClient.addMockResponse({
        url: `/projects/${mockOrganization.slug}/${mockProject.slug}/replays/replay-123/summarize/`,
        body: responsePromise,
      });

      const {result} = renderHookWithProviders(useReplaySummary, {
        organization: mockOrganization,
        initialProps: mockReplay,
      });

      // Wait for the return value to be in pending state
      await waitFor(() => {
        expect(result.current.isPending).toBe(true);
      });
      expect(result.current.isError).toBe(false);
      expect(mockGet).toHaveBeenCalledTimes(1);

      // Resolve the promise to clean up
      resolveResponse!();
    });
  });

  describe('pending behavior', () => {
    it('should be pending when status is PROCESSING', async () => {
      MockApiClient.addMockResponse({
        url: `/projects/${mockOrganization.slug}/${mockProject.slug}/replays/replay-123/summarize/`,
        body: {status: ReplaySummaryStatus.PROCESSING, data: undefined},
      });

      const {result} = renderHookWithProviders(useReplaySummary, {
        organization: mockOrganization,
        initialProps: mockReplay,
      });

      await waitFor(() => {
        expect(result.current.isPending).toBe(true);
      });
      expect(result.current.isError).toBe(false);
    });

    it('should not be pending when status is COMPLETED', async () => {
      MockApiClient.addMockResponse({
        url: `/projects/${mockOrganization.slug}/${mockProject.slug}/replays/replay-123/summarize/`,
        body: {
          status: ReplaySummaryStatus.COMPLETED,
          data: {summary: 'This is a test summary'},
        },
      });

      const {result} = renderHookWithProviders(useReplaySummary, {
        organization: mockOrganization,
        initialProps: mockReplay,
      });

      await waitFor(() => {
        expect(result.current.isPending).toBe(false);
      });
      expect(result.current.isError).toBe(false);
    });

    it('should not be pending when status is ERROR', async () => {
      MockApiClient.addMockResponse({
        url: `/projects/${mockOrganization.slug}/${mockProject.slug}/replays/replay-123/summarize/`,
        body: {status: ReplaySummaryStatus.ERROR, data: undefined},
      });

      const {result} = renderHookWithProviders(useReplaySummary, {
        organization: mockOrganization,
        initialProps: mockReplay,
      });

      await waitFor(() => {
        expect(result.current.isPending).toBe(false);
      });
      expect(result.current.isError).toBe(true);
    });
  });

  describe('regenerate behavior', () => {
    it('should regenerate the summary when the segment count increases', async () => {
      MockApiClient.addMockResponse({
        url: `/projects/${mockOrganization.slug}/${mockProject.slug}/replays/replay-123/summarize/`,
        body: {
          status: ReplaySummaryStatus.COMPLETED,
          data: {summary: 'This is a test summary'},
          num_segments: 1,
        },
      });

      const mockPostRequest = MockApiClient.addMockResponse({
        url: `/projects/${mockOrganization.slug}/${mockProject.slug}/replays/replay-123/summarize/`,
        method: 'POST',
      });

      const {result, rerender} = renderHookWithProviders(useReplaySummary, {
        organization: mockOrganization,
        initialProps: mockReplay,
      });

      await waitFor(() => {
        expect(result.current.isPending).toBe(false);
      });
      expect(result.current.isError).toBe(false);
      expect(mockPostRequest).toHaveBeenCalledTimes(0);

      // Update the segment count and expect a POST.
      mockReplayRecord.count_segments = 2;
      mockReplay.getReplay = jest.fn().mockReturnValue(mockReplayRecord);
      rerender(mockReplay);

      await waitFor(() => {
        expect(mockPostRequest).toHaveBeenCalledWith(
          `/projects/${mockOrganization.slug}/${mockProject.slug}/replays/replay-123/summarize/`,
          expect.objectContaining({
            method: 'POST',
            data: {num_segments: 2, temperature: ReplaySummaryTemp.MED},
          })
        );
      });
    });
  });
});
