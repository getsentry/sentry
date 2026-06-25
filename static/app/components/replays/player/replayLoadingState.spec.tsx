import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ReplayLoadingState} from 'sentry/components/replays/player/replayLoadingState';
import type {useLoadReplayReader} from 'sentry/utils/replays/hooks/useLoadReplayReader';
import type {ReplayReader} from 'sentry/utils/replays/replayReader';
import {RequestError} from 'sentry/utils/requestError/requestError';
import type {ReplayRecord} from 'sentry/views/explore/replays/types';

type ReaderResult = ReturnType<typeof useLoadReplayReader>;

function makeReaderResult(overrides: Partial<ReaderResult> = {}): ReaderResult {
  return {
    attachments: [],
    attachmentError: undefined,
    errors: [],
    feedbackEvents: [],
    fetchError: undefined,
    isError: false,
    isPending: false,
    onRetry: jest.fn(),
    projectSlug: 'project-slug',
    replay: {hasProcessingErrors: () => 0} as ReplayReader,
    replayId: 'replay-id',
    replayRecord: undefined,
    status: 'success',
    ...overrides,
  } as ReaderResult;
}

function requestError(status: number) {
  return new RequestError('GET', '/path', new Error('boom'), {
    status,
    statusText: '',
    responseText: '',
    responseJSON: {detail: 'boom'},
    getResponseHeader: () => null,
  });
}

function renderState(readerResult: ReaderResult) {
  return render(
    <ReplayLoadingState
      readerResult={readerResult}
      renderArchived={() => <div>Archived state</div>}
      renderError={() => <div>Error state</div>}
      renderThrottled={() => <div>Throttled state</div>}
      renderLoading={() => <div>Loading state</div>}
      renderMissing={() => <div>Missing state</div>}
    >
      {() => <div>Player</div>}
    </ReplayLoadingState>
  );
}

describe('ReplayLoadingState', () => {
  it('renders the player when there are no errors', () => {
    renderState(makeReaderResult());

    expect(screen.getByText('Player')).toBeInTheDocument();
  });

  it('renders the error state when the recording-segment fetch fails with a 5xx', () => {
    renderState(makeReaderResult({attachmentError: [requestError(500)]}));

    expect(screen.getByText('Error state')).toBeInTheDocument();
  });

  it('renders the throttled state when the recording-segment fetch is rate-limited', () => {
    renderState(makeReaderResult({attachmentError: [requestError(429)]}));

    expect(screen.getByText('Throttled state')).toBeInTheDocument();
  });

  it('renders the archived state when the replay is archived even if a segment fetch failed', () => {
    renderState(
      makeReaderResult({
        attachmentError: [requestError(500)],
        replayRecord: {is_archived: true} as ReplayRecord,
      })
    );

    expect(screen.getByText('Archived state')).toBeInTheDocument();
  });

  it('renders the error state when the replay record fetch fails', () => {
    renderState(makeReaderResult({fetchError: requestError(500)}));

    expect(screen.getByText('Error state')).toBeInTheDocument();
  });

  it('falls back to the missing-replay alert when a segment error has no custom error renderer', () => {
    render(
      <ReplayLoadingState
        readerResult={makeReaderResult({attachmentError: [requestError(500)]})}
      >
        {() => <div>Player</div>}
      </ReplayLoadingState>
    );

    expect(screen.getByTestId('replay-error')).toBeInTheDocument();
  });
});
