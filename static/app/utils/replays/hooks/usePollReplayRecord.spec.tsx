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

const invalidateQueries = jest.fn();

function wrapper({children}: {children?: ReactNode}) {
  const queryClient = makeTestQueryClient();
  queryClient.invalidateQueries = invalidateQueries;
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

jest.useFakeTimers();

describe('usePollReplayRecord', () => {
  beforeEach(() => {
    invalidateQueries();
    MockApiClient.clearMockResponses();
  });
  it('should fetch count_segments', async () => {
    const countSegments = 10;
    const replayRecord = replayRecordFixture({
      count_segments: countSegments,
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

    await waitFor(() =>
      expect(renderedPollHook.result.current?.count_segments).toBe(countSegments)
    );
  });

  it('should fetch new count_segments', async () => {
    const oldCountSegments = 10;
    const replayRecord = replayRecordFixture({count_segments: oldCountSegments});
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

    await waitFor(() =>
      expect(renderedHook.result.current?.count_segments).toBe(oldCountSegments)
    );

    MockApiClient.clearMockResponses();

    const newCountSegments = 11;
    const newReplayRecord = replayRecordFixture({count_segments: newCountSegments});

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replays/${newReplayRecord.id}/`,
      body: {data: newReplayRecord},
    });

    jest.advanceTimersToNextTimer();
    await waitFor(() =>
      expect(renderedHook.result.current?.count_segments).toBe(newCountSegments)
    );
  });

  it('should disable the hook when enabled is false', async () => {
    const oldCountSegments = 10;
    const replayRecord = replayRecordFixture({count_segments: oldCountSegments});
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

    await waitFor(() =>
      expect(renderedHook.result.current?.count_segments).toBe(oldCountSegments)
    );
    expect(endpoint).toHaveBeenCalledTimes(1);

    MockApiClient.clearMockResponses();

    const newCountSegments = 11;
    const newReplayRecord = replayRecordFixture({count_segments: newCountSegments});

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replays/${newReplayRecord.id}/`,
      body: {data: newReplayRecord},
    });

    renderedHook.rerender({
      enabled: false,
      orgSlug: organization.slug,
      replayId: replayRecord.id,
      pollInterval: 0,
    });

    await waitFor(() =>
      expect(renderedHook.result.current?.count_segments).toBe(oldCountSegments)
    );
  });
});
