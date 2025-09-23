import type {ReactNode} from 'react';
import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {Provider as ReplayContextProvider} from 'sentry/components/replays/replayContext';
import {ReplayReaderProvider} from 'sentry/utils/replays/playback/providers/replayReaderProvider';
import ReplayReader from 'sentry/utils/replays/replayReader';
import OurLogs from 'sentry/views/replays/detail/ourlogs';
import {useReplayTraces} from 'sentry/views/replays/detail/trace/useReplayTraces';

jest.mock('sentry/views/replays/detail/trace/useReplayTraces');

function Wrappers({
  children,
  replay = null,
}: {
  children: ReactNode;
  replay?: ReplayReader | null;
}) {
  return (
    <ReplayReaderProvider replay={replay}>
      <ReplayContextProvider analyticsContext="" isFetching={false} replay={replay}>
        {children}
      </ReplayContextProvider>
    </ReplayReaderProvider>
  );
}

const mockReplay = ReplayReader.factory({
  replayRecord: ReplayRecordFixture({
    browser: {
      name: 'Chrome',
      version: '110.0.0',
    },
    tags: {
      foo: ['bar', 'baz'],
      my_custom_tag: ['a wordy value'],
    },
  }),
  errors: [],
  fetching: false,
  attachments: [],
});

describe('OurLogs', () => {
  beforeEach(() => {
    // Seeing this error: <tbody> cannot be a child of <div>.
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should show a placeholder if there's no replay record", () => {
    jest.mocked(useReplayTraces).mockReturnValue({
      replayTraces: [],
      indexComplete: true,
      indexError: undefined,
    } as any);

    render(
      <Wrappers>
        <OurLogs />
      </Wrappers>
    );

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
  });

  it("shows logs table if there's replay traces", () => {
    jest.mocked(useReplayTraces).mockReturnValue({
      replayTraces: [
        {timestamp: undefined, traceSlug: 'trace1'},
        {timestamp: undefined, traceSlug: 'trace2'},
      ],
      indexComplete: true,
      indexError: undefined,
    } as any);

    render(
      <Wrappers replay={mockReplay}>
        <OurLogs />
      </Wrappers>
    );

    expect(screen.getByTestId('loading-placeholder')).toBeInTheDocument();
  });
});
