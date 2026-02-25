import {OrganizationFixture} from 'sentry-fixture/organization';
import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import type {HydratedReplayRecord} from 'sentry/views/replays/types';

import usePollReplayRecord from './usePollReplayRecord';

const organization = OrganizationFixture();

function replayRecordFixture(replayRecord?: Partial<HydratedReplayRecord>) {
  return ReplayRecordFixture({
    ...replayRecord,
    project_id: '1',
  });
}

jest.useFakeTimers();

describe('usePollReplayRecord', () => {
  beforeEach(() => {
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

    const renderedPollHook = renderHookWithProviders(usePollReplayRecord, {
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

    const renderedHook = renderHookWithProviders(usePollReplayRecord, {
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
});
