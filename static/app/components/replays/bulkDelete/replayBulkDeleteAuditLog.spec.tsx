import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {ReplayBulkDeleteAuditLog} from 'sentry/components/replays/bulkDelete/replayBulkDeleteAuditLog';
import type {ReplayBulkDeleteAuditLog as ReplayBulkDeleteAuditLogJob} from 'sentry/components/replays/bulkDelete/types';

describe('ReplayBulkDeleteAuditLog', () => {
  const organization = OrganizationFixture();
  const url = `/projects/${organization.slug}/project-slug/replays/jobs/delete/`;

  function jobFixture(
    params: Partial<ReplayBulkDeleteAuditLogJob> = {}
  ): ReplayBulkDeleteAuditLogJob {
    return {
      id: 1,
      countDeleted: 100,
      dateCreated: '2026-07-28T00:00:00Z',
      dateUpdated: '2026-07-28T00:00:00Z',
      environments: ['prod'],
      query: '',
      rangeEnd: '2026-07-27T00:00:00Z',
      rangeStart: '2026-07-26T00:00:00Z',
      status: 'in-progress',
      ...params,
    };
  }

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('polls for progress while a job is running', async () => {
    const mock = MockApiClient.addMockResponse({
      url,
      body: {data: [jobFixture({status: 'in-progress'})]},
    });

    render(<ReplayBulkDeleteAuditLog projectSlug="project-slug" />, {organization});

    await waitFor(() => expect(mock).toHaveBeenCalledTimes(1));

    act(() => {
      jest.advanceTimersByTime(5_000);
    });

    await waitFor(() => expect(mock).toHaveBeenCalledTimes(2));
  });

  it('stops polling once no job is running', async () => {
    const mock = MockApiClient.addMockResponse({
      url,
      body: {data: [jobFixture({status: 'completed'})]},
    });

    render(<ReplayBulkDeleteAuditLog projectSlug="project-slug" />, {organization});

    await waitFor(() => expect(mock).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('completed')).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(60_000);
    });

    expect(mock).toHaveBeenCalledTimes(1);
  });
});
