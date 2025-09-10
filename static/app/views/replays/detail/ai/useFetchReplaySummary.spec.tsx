import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import useProjectFromId from 'sentry/utils/useProjectFromId';
import {
  ReplaySummaryStatus,
  ReplaySummaryTemp,
} from 'sentry/views/replays/detail/ai/utils';

import {useFetchReplaySummary} from './useFetchReplaySummary';

jest.mock('sentry/utils/replays/playback/providers/replayReaderProvider');
jest.mock('sentry/utils/useProjectFromId');

const mockUseProjectFromId = jest.mocked(useProjectFromId);

describe('useFetchReplaySummary', () => {
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

      const {result} = renderHookWithProviders(() => useFetchReplaySummary(mockReplay), {
        organization: mockOrganization,
      });

      await waitFor(() => {
        expect(result.current.summaryData).toEqual(mockSummaryData);
      });
      expect(result.current.isPolling).toBe(false);
      expect(result.current.isPending).toBe(false);
      expect(result.current.isError).toBe(false);
      expect(mockRequest).toHaveBeenCalledTimes(1);
    });

    it('should handle API errors gracefully', async () => {
      MockApiClient.addMockResponse({
        url: `/projects/${mockOrganization.slug}/${mockProject.slug}/replays/replay-123/summarize/`,
        statusCode: 500,
        body: {detail: 'Internal server error'},
      });

      const {result} = renderHookWithProviders(() => useFetchReplaySummary(mockReplay), {
        organization: mockOrganization,
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
      expect(result.current.isPolling).toBe(false);
      expect(result.current.isPending).toBe(false);
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
        () => useFetchReplaySummary(mockReplay, {enabled: false, staleTime: 0}),
        {
          organization: mockOrganization,
        }
      );

      // The hook should not make API calls when disabled
      expect(result.current.summaryData).toBeUndefined();
      expect(result.current.isPolling).toBe(false);
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
        () => useFetchReplaySummary(mockReplay, {enabled: true, staleTime: 0}),
        {
          organization: mockOrganization,
        }
      );

      await waitFor(() => {
        expect(result.current.summaryData).toBeDefined();
      });
      expect(result.current.isPolling).toBe(false);
      expect(result.current.isPending).toBe(false);
      expect(result.current.isError).toBe(false);
    });

    it('should poll when summary data is undefined and startSummaryRequest is pending', async () => {
      // Mock the initial query to return undefined data
      const initialQuery = MockApiClient.addMockResponse({
        url: `/projects/${mockOrganization.slug}/${mockProject.slug}/replays/replay-123/summarize/`,
        body: undefined,
      });

      // Mock the POST request for starting the summary request - make it hang
      let resolveStartSummaryRequest: (value?: any) => void;
      const startSummaryRequestPromise = new Promise(resolve => {
        resolveStartSummaryRequest = resolve;
      });

      const startSummaryRequest = MockApiClient.addMockResponse({
        url: `/projects/${mockOrganization.slug}/${mockProject.slug}/replays/replay-123/summarize/`,
        method: 'POST',
        body: startSummaryRequestPromise,
      });

      const {result} = renderHookWithProviders(() => useFetchReplaySummary(mockReplay), {
        organization: mockOrganization,
      });

      // Start the summary mutation
      result.current.startSummaryRequest();

      // Wait for the mutation to be in pending state
      await waitFor(() => {
        expect(result.current.isStartSummaryRequestPending).toBe(true);
      });

      expect(result.current.summaryData).toBeUndefined();
      expect(result.current.isPolling).toBe(true);
      expect(initialQuery).toHaveBeenCalledTimes(1);
      expect(startSummaryRequest).toHaveBeenCalledTimes(1);

      // Resolve the promise to clean up
      resolveStartSummaryRequest!();
    });
  });

  describe('polling behavior', () => {
    it('should poll when status is PROCESSING', async () => {
      MockApiClient.addMockResponse({
        url: `/projects/${mockOrganization.slug}/${mockProject.slug}/replays/replay-123/summarize/`,
        body: {status: ReplaySummaryStatus.PROCESSING, data: undefined},
      });

      const {result} = renderHookWithProviders(() => useFetchReplaySummary(mockReplay), {
        organization: mockOrganization,
      });

      await waitFor(() => {
        expect(result.current.isPolling).toBe(true);
      });
      expect(result.current.isPending).toBe(true);
      expect(result.current.isError).toBe(false);
    });

    it('should stop polling when status is COMPLETED', async () => {
      MockApiClient.addMockResponse({
        url: `/projects/${mockOrganization.slug}/${mockProject.slug}/replays/replay-123/summarize/`,
        body: {
          status: ReplaySummaryStatus.COMPLETED,
          data: {summary: 'This is a test summary'},
        },
      });

      const {result} = renderHookWithProviders(() => useFetchReplaySummary(mockReplay), {
        organization: mockOrganization,
      });

      await waitFor(() => {
        expect(result.current.isPolling).toBe(false);
      });
      expect(result.current.isPending).toBe(false);
      expect(result.current.isError).toBe(false);
    });

    it('should stop polling when status is ERROR', async () => {
      MockApiClient.addMockResponse({
        url: `/projects/${mockOrganization.slug}/${mockProject.slug}/replays/replay-123/summarize/`,
        body: {status: ReplaySummaryStatus.ERROR, data: undefined},
      });

      const {result} = renderHookWithProviders(() => useFetchReplaySummary(mockReplay), {
        organization: mockOrganization,
      });

      await waitFor(() => {
        expect(result.current.isPolling).toBe(false);
      });
      expect(result.current.isPending).toBe(false);
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

      const {result, rerender} = renderHookWithProviders(
        () => useFetchReplaySummary(mockReplay),
        {
          organization: mockOrganization,
        }
      );

      await waitFor(() => {
        expect(result.current.isPolling).toBe(false);
      });
      expect(result.current.isPending).toBe(false);
      expect(result.current.isError).toBe(false);
      expect(mockPostRequest).toHaveBeenCalledTimes(0);

      // Update the segment count and expect a POST.
      mockReplayRecord.count_segments = 2;
      mockReplay.getReplay = jest.fn().mockReturnValue(mockReplayRecord);
      rerender();

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
