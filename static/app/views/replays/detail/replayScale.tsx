import styled from '@emotion/styled';

import {Flex} from 'sentry/components/core/layout/flex';
import {Tooltip} from 'sentry/components/core/tooltip';
import Placeholder from 'sentry/components/placeholder';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import toPercent from 'sentry/utils/number/toPercent';
import {useReplayPlayerSize} from 'sentry/utils/replays/playback/providers/replayPlayerSizeContext';

interface Props {
  isLoading: boolean;
}

export default function ReplayScale({isLoading}: Props) {
  const {dimensions} = useReplayContext();
  const [{scale}] = useReplayPlayerSize();

  if (isLoading) {
    return <Placeholder width="130px" height="32px" />;
  }

  return (
    <Flex gap={space(0.5)}>
      <Tooltip skipWrapper title={t('The size of the screen the replay was recorded on')}>
        <ScreenSize>
          {dimensions.width} &times; {dimensions.height}
        </ScreenSize>
      </Tooltip>
      <Tooltip skipWrapper title={t('Size of the replay playback window')}>
        <Percent>{toPercent(scale, 1)}</Percent>
      </Tooltip>
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
