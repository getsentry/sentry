import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import {useReplayReader} from 'sentry/utils/replays/playback/providers/replayReaderProvider';
import useProjectFromId from 'sentry/utils/useProjectFromId';
import {OrganizationContext} from 'sentry/views/organizationContext';
import {ReplaySummaryStatus} from 'sentry/views/replays/detail/ai/utils';

import {useFetchReplaySummary} from './useFetchReplaySummary';

jest.mock('sentry/utils/replays/playback/providers/replayReaderProvider');
jest.mock('sentry/utils/useProjectFromId');

const mockUseReplayReader = jest.mocked(useReplayReader);
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
    };
    mockReplay = {
      getReplay: jest.fn().mockReturnValue(mockReplayRecord),
    };
    mockOrganization = OrganizationFixture();
    mockProject = ProjectFixture({
      slug: 'test-project',
    });

    mockUseReplayReader.mockReturnValue(mockReplay);
    mockUseProjectFromId.mockReturnValue(mockProject);
  });

  const createWrapper = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {retry: false},
        mutations: {retry: false},
      },
    });

    return function ({children}: {children: React.ReactNode}) {
      return (
        <QueryClientProvider client={queryClient}>
          <OrganizationContext value={mockOrganization}>{children}</OrganizationContext>
        </QueryClientProvider>
      );
    };
  };

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

      const {result} = renderHook(() => useFetchReplaySummary(), {
        wrapper: createWrapper(),
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

      const {result} = renderHook(() => useFetchReplaySummary(), {
        wrapper: createWrapper(),
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

      const {result} = renderHook(
        () => useFetchReplaySummary({enabled: false, staleTime: 0}),
        {
          wrapper: createWrapper(),
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

      const {result} = renderHook(
        () => useFetchReplaySummary({enabled: true, staleTime: 0}),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => {
        expect(result.current.summaryData).toBeDefined();
      });
      expect(result.current.isPolling).toBe(false);
      expect(result.current.isPending).toBe(false);
      expect(result.current.isError).toBe(false);
    });
  });

  describe('polling behavior', () => {
    it('should poll when status is PROCESSING', async () => {
      MockApiClient.addMockResponse({
        url: `/projects/${mockOrganization.slug}/${mockProject.slug}/replays/replay-123/summarize/`,
        body: {status: ReplaySummaryStatus.PROCESSING, data: undefined},
      });

      const {result} = renderHook(() => useFetchReplaySummary(), {
        wrapper: createWrapper(),
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

      const {result} = renderHook(() => useFetchReplaySummary(), {
        wrapper: createWrapper(),
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

      const {result} = renderHook(() => useFetchReplaySummary(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isPolling).toBe(false);
      });
      expect(result.current.isPending).toBe(false);
      expect(result.current.isError).toBe(true);
    });
  });
});
