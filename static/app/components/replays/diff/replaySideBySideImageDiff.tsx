import styled from '@emotion/styled';

import {Stack, Grid} from '@sentry/scraps/layout';

import {ContentSliderDiff} from 'sentry/components/contentSliderDiff';
import {ReplayPlayer} from 'sentry/components/replays/player/replayPlayer';
import {ReplayPlayerMeasurer} from 'sentry/components/replays/player/replayPlayerMeasurer';
import {ReplayPlayerPluginsContextProvider} from 'sentry/utils/replays/playback/providers/replayPlayerPluginsContext';
import {ReplayPlayerStateContextProvider} from 'sentry/utils/replays/playback/providers/replayPlayerStateContext';
import {ReplayReaderProvider} from 'sentry/utils/replays/playback/providers/replayReaderProvider';

import {useDiffCompareContext} from './diffCompareContext';
import {After, Before} from './utils';

export function ReplaySideBySideImageDiff() {
  const {replay, leftOffsetMs, rightOffsetMs} = useDiffCompareContext();

  return (
    <Stack>
      <ContentSliderDiff.Header>
        <Before startTimestampMs={replay.getStartTimestampMs()} offset={leftOffsetMs} />
        <After startTimestampMs={replay.getStartTimestampMs()} offset={rightOffsetMs} />
      </ContentSliderDiff.Header>

      <Grid columns="1fr 1fr">
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
      </Grid>
    </Stack>
  );
}

const Border = styled('span')`
  border: 3px solid;
  border-radius: ${p => p.theme.space.xs};
  border-color: ${p => p.theme.colors.red400};
  & + & {
    border-color: ${p => p.theme.colors.green400};
  }
  overflow: hidden;
`;
