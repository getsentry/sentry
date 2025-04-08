import {Fragment} from 'react';

import {
  ContentSliderDiff,
  type ContentSliderDiffBodyProps,
} from 'sentry/components/contentSliderDiff';
import {useDiffCompareContext} from 'sentry/components/replays/diff/diffCompareContext';
import {After, Before} from 'sentry/components/replays/diff/utils';
import ReplayPlayer from 'sentry/components/replays/player/replayPlayer';
import ReplayPlayerMeasurer from 'sentry/components/replays/player/replayPlayerMeasurer';
import {ReplayPlayerPluginsContextProvider} from 'sentry/utils/replays/playback/providers/replayPlayerPluginsContext';
import {ReplayPlayerStateContextProvider} from 'sentry/utils/replays/playback/providers/replayPlayerStateContext';
import {ReplayReaderProvider} from 'sentry/utils/replays/playback/providers/replayReaderProvider';

export function ReplaySliderDiff({
  minHeight,
}: Pick<ContentSliderDiffBodyProps, 'minHeight'>) {
  const {replay, leftOffsetMs, rightOffsetMs} = useDiffCompareContext();
  return (
    <Fragment>
      <ContentSliderDiff.Header>
        <Before startTimestampMs={replay.getStartTimestampMs()} offset={leftOffsetMs} />
        <After startTimestampMs={replay.getStartTimestampMs()} offset={rightOffsetMs} />
      </ContentSliderDiff.Header>
      <ReplayPlayerPluginsContextProvider>
        <ReplayReaderProvider replay={replay}>
          <ContentSliderDiff.Body
            minHeight={minHeight}
            before={
              <ReplayPlayerStateContextProvider>
                <ReplayPlayerMeasurer>
                  {style => <ReplayPlayer style={style} offsetMs={leftOffsetMs} />}
                </ReplayPlayerMeasurer>
              </ReplayPlayerStateContextProvider>
            }
            after={
              <ReplayPlayerStateContextProvider>
                <ReplayPlayerMeasurer>
                  {style => <ReplayPlayer style={style} offsetMs={rightOffsetMs} />}
                </ReplayPlayerMeasurer>
              </ReplayPlayerStateContextProvider>
            }
          />
        </ReplayReaderProvider>
      </ReplayPlayerPluginsContextProvider>
    </Fragment>
  );
}
