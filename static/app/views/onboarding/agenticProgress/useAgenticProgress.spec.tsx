import type {UseStreamOptions} from 'conduit-client';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {AgenticProgressRunFixture} from './fixtures';
import type {AgenticProgressRun} from './types';
import {useAgenticProgress} from './useAgenticProgress';

const mockUseStream = jest.fn((_options: UseStreamOptions<AgenticProgressRun>) => ({
  error: null,
  isConnected: false,
}));

jest.mock('conduit-client', () => ({
  useStream: (options: UseStreamOptions<AgenticProgressRun>) => mockUseStream(options),
}));

function getStreamOptions() {
  const options = mockUseStream.mock.lastCall?.[0];

  if (!options) {
    throw new Error('useStream was not called');
  }

  return options;
}

describe('useAgenticProgress', () => {
  const run = AgenticProgressRunFixture();
  const endpoint = `/organizations/org-slug/onboarding/agent/runs/${run.runId}/`;

  beforeEach(() => {
    mockUseStream.mockClear();
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('loads the current state and configures the Conduit stream', async () => {
    MockApiClient.addMockResponse({url: endpoint, body: run});

    const {result} = renderHookWithProviders(
      () => useAgenticProgress({runId: run.runId}),
      {organization: {slug: 'org-slug'}}
    );

    await waitFor(() => expect(result.current.data).toEqual(run));
    await waitFor(() => expect(getStreamOptions().enabled).toBe(true));

    expect(getStreamOptions()).toEqual(
      expect.objectContaining({
        orgId: 3,
        startStreamData: {clientRunId: run.clientRunId},
        startStreamUrl: '/organizations/org-slug/onboarding/agent/runs/',
      })
    );
  });

  it('accepts snapshots and ignores stale stream messages', async () => {
    MockApiClient.addMockResponse({url: endpoint, body: run});
    const {result} = renderHookWithProviders(
      () => useAgenticProgress({runId: run.runId}),
      {organization: {slug: 'org-slug'}}
    );

    await waitFor(() => expect(getStreamOptions().enabled).toBe(true));
    const sequenceOne = AgenticProgressRunFixture({sequence: 1});

    act(() => getStreamOptions().onMessage?.(sequenceOne));
    expect(result.current.data?.sequence).toBe(1);

    act(() => getStreamOptions().onMessage?.(run));
    expect(result.current.data?.sequence).toBe(1);
  });
});
