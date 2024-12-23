import styled from '@emotion/styled';

import {Flex} from 'sentry/components/container/flex';
import {After, Before, DiffHeader} from 'sentry/components/replays/diff/utils';
import ReplayPlayer from 'sentry/components/replays/player/replayPlayer';
import ReplayPlayerMeasurer from 'sentry/components/replays/player/replayPlayerMeasurer';
import {space} from 'sentry/styles/space';
import {ReplayPlayerPluginsContextProvider} from 'sentry/utils/replays/playback/providers/replayPlayerPluginsContext';
import {ReplayPlayerStateContextProvider} from 'sentry/utils/replays/playback/providers/replayPlayerStateContext';
import {ReplayReaderProvider} from 'sentry/utils/replays/playback/providers/replayReaderProvider';
import type ReplayReader from 'sentry/utils/replays/replayReader';

interface Props {
  leftOffsetMs: number;
  replay: ReplayReader;
  rightOffsetMs: number;
}

export function ReplaySideBySideImageDiff({leftOffsetMs, replay, rightOffsetMs}: Props) {
  return (
    <Flex column>
      <DiffHeader>
        <Before />
        <After />
      </DiffHeader>

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
  border-color: ${p => p.theme.red300};
  & + & {
    border-color: ${p => p.theme.green300};
  }
  overflow: hidden;
`;
