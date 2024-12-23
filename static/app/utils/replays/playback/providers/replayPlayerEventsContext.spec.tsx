import type {ReactNode} from 'react';
import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';

import {renderHook} from 'sentry-test/reactTestingLibrary';

import {
  ReplayPlayerEventsContextProvider,
  useReplayPlayerEvents,
} from 'sentry/utils/replays/playback/providers/replayPlayerEventsContext';
import ReplayReader from 'sentry/utils/replays/replayReader';

function makeWrapper(replay: ReplayReader) {
  return function ({children}: {children?: ReactNode}) {
    return (
      <ReplayPlayerEventsContextProvider replay={replay}>
        {children}
      </ReplayPlayerEventsContextProvider>
    );
  };
}

describe('replayPlayerEventsContext', () => {
  it('should have a stable to the list of rrweb event frames and video frames', () => {
    const mockReplay = ReplayReader.factory({
      attachments: [],
      errors: [],
      fetching: false,
      replayRecord: ReplayRecordFixture(),
    });

    const {result, rerender} = renderHook(useReplayPlayerEvents, {
      wrapper: makeWrapper(mockReplay!),
    });

    const initialRef = result.current;

    rerender();

    expect(result.current).toEqual(initialRef);
  });

  it('should return the rrweb frames and video frames for the replay', () => {
    const mockReplay = ReplayReader.factory({
      attachments: [],
      errors: [],
      fetching: false,
      replayRecord: ReplayRecordFixture(),
    });
    const mockRRwebFrames: any[] = [];
    mockReplay!.getRRWebFrames = jest.fn().mockReturnValue(mockRRwebFrames);
    const mockVideoFrames: any[] = [];
    mockReplay!.getVideoEvents = jest.fn().mockReturnValue(mockVideoFrames);

    const {result} = renderHook(useReplayPlayerEvents, {
      wrapper: makeWrapper(mockReplay!),
    });

    expect(result.current).toHaveLength(2);
    expect(result.current[0]).toStrictEqual(mockRRwebFrames);
    expect(result.current[1]).toStrictEqual(mockVideoFrames);
  });
});
