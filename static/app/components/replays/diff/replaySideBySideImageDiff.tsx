import styled from '@emotion/styled';

import {ContentSliderDiff} from 'sentry/components/contentSliderDiff';
import {Flex} from 'sentry/components/core/layout';
import {useDiffCompareContext} from 'sentry/components/replays/diff/diffCompareContext';
import {After, Before} from 'sentry/components/replays/diff/utils';
import ReplayPlayer from 'sentry/components/replays/player/replayPlayer';
import ReplayPlayerMeasurer from 'sentry/components/replays/player/replayPlayerMeasurer';
import {space} from 'sentry/styles/space';
import {ReplayPlayerPluginsContextProvider} from 'sentry/utils/replays/playback/providers/replayPlayerPluginsContext';
import {ReplayPlayerStateContextProvider} from 'sentry/utils/replays/playback/providers/replayPlayerStateContext';
import {ReplayReaderProvider} from 'sentry/utils/replays/playback/providers/replayReaderProvider';

export function ReplaySideBySideImageDiff() {
  const {replay, leftOffsetMs, rightOffsetMs} = useDiffCompareContext();

  return (
    <Flex direction="column">
      <ContentSliderDiff.Header>
        <Before startTimestampMs={replay.getStartTimestampMs()} offset={leftOffsetMs} />
        <After startTimestampMs={replay.getStartTimestampMs()} offset={rightOffsetMs} />
      </ContentSliderDiff.Header>

      <ReplayGrid>
        <ReplayPlayerPluginsContextProvider>
          <ReplayReaderProvider replay={replay}>
            <Border>
              <ReplayPlayerStateContextProvider>
                <ReplayPlayerMeasurer measure="width">
                  {style => <ReplayPlayer style={style} offsetMs={leftOffsetMs} />}
                </ReplayPlayerMeasurer>
              </ReplayPlayerStateContextProvider>
            </Border>
            <Border>
              <ReplayPlayerStateContextProvider>
                <ReplayPlayerMeasurer measure="width">
                  {style => <ReplayPlayer style={style} offsetMs={rightOffsetMs} />}
                </ReplayPlayerMeasurer>
              </ReplayPlayerStateContextProvider>
            </Border>
          </ReplayReaderProvider>
        </ReplayPlayerPluginsContextProvider>
      </ReplayGrid>
    </Flex>
  );
}

const ReplayGrid = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
`;

const Border = styled('span')`
  border: 3px solid;
  border-radius: ${space(0.5)};
  border-color: ${p => p.theme.colors.red400};
  & + & {
    border-color: ${p => p.theme.colors.green400};
  }
  overflow: hidden;
`;
