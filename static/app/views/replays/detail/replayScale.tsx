import styled from '@emotion/styled';

import {Flex} from 'sentry/components/core/layout/flex';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {space} from 'sentry/styles/space';
import toPercent from 'sentry/utils/number/toPercent';
import {useReplayPlayerSize} from 'sentry/utils/replays/playback/providers/replayPlayerSizeContext';

export default function ReplayScale() {
  const {dimensions} = useReplayContext();
  const [{scale}] = useReplayPlayerSize();

  return (
    <Flex gap={space(0.5)}>
      <ScreenSize>
        {dimensions.width} &times; {dimensions.height}
      </ScreenSize>
      <Percent>{toPercent(scale, 1)}</Percent>
    </Flex>
  );
}

const ScreenSize = styled('span')`
  font-variant-numeric: tabular-nums;
`;

const Percent = styled('span')`
  font-variant-numeric: tabular-nums;
  color: ${p => p.theme.tokens.content.muted};
`;
