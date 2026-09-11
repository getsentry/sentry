import {workerFetch} from 'sentry/serviceWorker/worker/fetch';
import type {SeerExplorerSendMessageData} from 'sentry/serviceWorker/worker/handleSeerExplorerSendMessage';
import {handleSeerExplorerSendMessage} from 'sentry/serviceWorker/worker/handleSeerExplorerSendMessage';
import {showNotification} from 'sentry/serviceWorker/worker/showNotification';

jest.mock('sentry/serviceWorker/worker/fetch');
jest.mock('sentry/serviceWorker/worker/showNotification');

const mockWorkerFetch = jest.mocked(workerFetch);
const mockShowNotification = jest.mocked(showNotification);

const POLL_INTERVAL_MS = 2_000;
const START_GRACE_MS = 10_000;

const sw = {} as ServiceWorkerGlobalScope;

/** The endpoint returns timestamps with no zone marker. */
function utcTimestamp(msAgo = 0): string {
  return new Date(Date.now() - msAgo).toISOString().replace('Z', '');
}

interface SessionOverrides {
  blocks?: Array<{loading?: boolean}>;
  failure_reason?: string | null;
  repo_pr_states?: Record<string, {pr_creation_status?: string | null}>;
  status?: string;
  updated_at?: string;
}

function respondWith(session: SessionOverrides | null) {
  const body = {
    session: session && {
      blocks: [],
      status: 'completed',
      updated_at: utcTimestamp(),
      ...session,
    },
  };
  return {json: () => Promise.resolve(body)} as Response;
}

function makeData(runId: string): SeerExplorerSendMessageData {
  return {
    organizationIdOrSlug: 'org-slug',
    runId,
    notification: {
      icon: 'https://sentry.io/favicon.ico',
      navigateTo: {pathname: '/issues/', query: {explorerRunId: runId}},
      title: {success: 'Seer has an answer', error: 'Seer ran into a problem'},
      body: {success: 'why is this slow', error: 'Seer could not finish this request.'},
    },
  };
}

describe('handleSeerExplorerSendMessage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('notifies once the agent has finished replying', async () => {
    mockWorkerFetch
      .mockResolvedValueOnce(respondWith({status: 'processing'}))
      .mockResolvedValueOnce(respondWith({status: 'completed'}));

    const promise = handleSeerExplorerSendMessage(sw, makeData('run-finishes'));
    await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    await promise;

    expect(mockShowNotification).toHaveBeenCalledWith(
      sw,
      expect.objectContaining({
        title: 'Seer has an answer',
        options: expect.objectContaining({
          body: 'why is this slow',
          tag: 'seer-explorer-run-finishes',
        }),
      })
    );
  });

  it('keeps polling while a block is still loading', async () => {
    mockWorkerFetch
      .mockResolvedValueOnce(respondWith({status: 'processing'}))
      .mockResolvedValueOnce(
        respondWith({status: 'completed', blocks: [{loading: true}]})
      )
      .mockResolvedValueOnce(
        respondWith({status: 'completed', blocks: [{loading: false}]})
      );

    const promise = handleSeerExplorerSendMessage(sw, makeData('run-loading-block'));
    await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    expect(mockShowNotification).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    await promise;

    expect(mockShowNotification).toHaveBeenCalledTimes(1);
  });

  it('keeps polling while a pull request is still being created', async () => {
    mockWorkerFetch
      .mockResolvedValueOnce(respondWith({status: 'processing'}))
      .mockResolvedValueOnce(
        respondWith({
          status: 'completed',
          repo_pr_states: {'owner/repo': {pr_creation_status: 'creating'}},
        })
      )
      .mockResolvedValueOnce(
        respondWith({
          status: 'completed',
          repo_pr_states: {'owner/repo': {pr_creation_status: 'completed'}},
        })
      );

    const promise = handleSeerExplorerSendMessage(sw, makeData('run-pr'));
    await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    expect(mockShowNotification).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    await promise;

    expect(mockShowNotification).toHaveBeenCalledTimes(1);
  });

  it('ignores the previous turn until the new one has started', async () => {
    // The run is not marked `processing` yet, so every early poll still
    // describes the reply the user already read.
    mockWorkerFetch.mockResolvedValue(respondWith({status: 'completed'}));

    const promise = handleSeerExplorerSendMessage(sw, makeData('run-race'));
    await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3);
    expect(mockShowNotification).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(START_GRACE_MS);
    await promise;

    expect(mockShowNotification).toHaveBeenCalledTimes(1);
  });

  it('skips a result that finished too long ago to still matter', async () => {
    mockWorkerFetch
      .mockResolvedValueOnce(respondWith({status: 'processing'}))
      .mockResolvedValueOnce(
        respondWith({status: 'completed', updated_at: utcTimestamp(10 * 60 * 1_000)})
      );

    const promise = handleSeerExplorerSendMessage(sw, makeData('run-stale'));
    await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    await promise;

    expect(mockShowNotification).not.toHaveBeenCalled();
  });

  it('uses the error copy when the run fails', async () => {
    mockWorkerFetch
      .mockResolvedValueOnce(respondWith({status: 'processing'}))
      .mockResolvedValueOnce(respondWith({status: 'error'}));

    const promise = handleSeerExplorerSendMessage(sw, makeData('run-error'));
    await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    await promise;

    expect(mockShowNotification).toHaveBeenCalledWith(
      sw,
      expect.objectContaining({
        title: 'Seer ran into a problem',
        options: expect.objectContaining({
          body: 'Seer could not finish this request.',
        }),
      })
    );
  });

  it('uses the error copy when the run times out', async () => {
    mockWorkerFetch
      .mockResolvedValueOnce(respondWith({status: 'processing'}))
      .mockResolvedValueOnce(
        respondWith({status: 'completed', failure_reason: 'timeout'})
      );

    const promise = handleSeerExplorerSendMessage(sw, makeData('run-timeout'));
    await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    await promise;

    expect(mockShowNotification).toHaveBeenCalledWith(
      sw,
      expect.objectContaining({title: 'Seer ran into a problem'})
    );
  });

  it('notifies once when a second message supersedes the first', async () => {
    mockWorkerFetch
      .mockResolvedValueOnce(respondWith({status: 'processing'}))
      .mockResolvedValue(respondWith({status: 'completed'}));

    const first = handleSeerExplorerSendMessage(sw, makeData('run-superseded'));
    const second = handleSeerExplorerSendMessage(sw, makeData('run-superseded'));

    await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS + START_GRACE_MS);
    await Promise.all([first, second]);

    expect(mockShowNotification).toHaveBeenCalledTimes(1);
  });
});
