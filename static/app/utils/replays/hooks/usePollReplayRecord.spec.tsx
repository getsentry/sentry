import {type ReactNode} from 'react';
import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {makeTestQueryClient} from 'sentry-test/queryClient';
import {renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import {QueryClientProvider} from 'sentry/utils/queryClient';
import {OrganizationContext} from 'sentry/views/organizationContext';
import type {HydratedReplayRecord} from 'sentry/views/replays/types';

import usePollReplayRecord from './usePollReplayRecord';

const {organization, project} = initializeOrg();

function wrapper({children}: {children?: ReactNode}) {
  const queryClient = makeTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <OrganizationContext value={organization}>{children}</OrganizationContext>
    </QueryClientProvider>
  );
}

function replayRecordFixture(replayRecord?: Partial<HydratedReplayRecord>) {
  return ReplayRecordFixture({
    ...replayRecord,
    project_id: project.id,
  });
}
describe('usePollReplayRecord', () => {
  it('should fetch count_segments', async () => {
    const count_segments = 10;
    const replayRecord = replayRecordFixture({
      count_segments,
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replays/${replayRecord.id}/`,
      body: {data: replayRecord},
    });

    const renderedPollHook = renderHook(usePollReplayRecord, {
      wrapper,
      initialProps: {
        enabled: true,
        orgSlug: organization.slug,
        replayId: replayRecord.id,
      },
    });

    await waitFor(() => expect(renderedPollHook.result.current).toBe(count_segments));
  });

  jest.useFakeTimers();
  it('should fetch new count_segments', async () => {
    let count_segments = 20;
    let replayRecord = replayRecordFixture({count_segments});
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replays/${replayRecord.id}/`,
      body: {data: replayRecord},
    });

    const renderedHook = renderHook(usePollReplayRecord, {
      wrapper,
      initialProps: {
        enabled: true,
        orgSlug: organization.slug,
        replayId: replayRecord.id,
      },
    });

    await waitFor(() => expect(renderedHook.result.current).toBe(count_segments));

    MockApiClient.clearMockResponses();

    count_segments = 30;
    replayRecord = replayRecordFixture({count_segments});

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replays/${replayRecord.id}/`,
      body: {data: replayRecord},
    });

    jest.advanceTimersToNextTimer();
    await waitFor(() => expect(renderedHook.result.current).toBe(count_segments));
  });

  it('should disable the hook when enabled is false', async () => {
    const old_count_segments = 40;
    let replayRecord = replayRecordFixture({count_segments: old_count_segments});
    const endpoint = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replays/${replayRecord.id}/`,
      body: {data: replayRecord},
    });

    const renderedHook = renderHook(usePollReplayRecord, {
      wrapper,
      initialProps: {
        enabled: true,
        orgSlug: organization.slug,
        replayId: replayRecord.id,
        pollInterval: 0,
      },
    });

    await waitFor(() => expect(renderedHook.result.current).toBe(old_count_segments));
    expect(endpoint).toHaveBeenCalledTimes(1);

    MockApiClient.clearMockResponses();

    const new_count_segments = 50;
    replayRecord = replayRecordFixture({count_segments: new_count_segments});

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replays/${replayRecord.id}/`,
      body: {data: replayRecord},
    });

    renderedHook.rerender({
      enabled: false,
      orgSlug: organization.slug,
      replayId: replayRecord.id,
      pollInterval: 0,
    });

    await waitFor(() => expect(renderedHook.result.current).toBe(old_count_segments));
  });
});
