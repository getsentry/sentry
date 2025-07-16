import {Tooltip} from 'sentry/components/core/tooltip';
import Placeholder from 'sentry/components/placeholder';
import CountTooltipContent from 'sentry/components/replays/countTooltipContent';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {IconWindow} from 'sentry/icons/iconWindow';
import {t} from 'sentry/locale';
import toPercent from 'sentry/utils/number/toPercent';
import {useReplayPlayerSize} from 'sentry/utils/replays/playback/providers/replayPlayerSizeContext';

interface Props {
  isLoading: boolean;
}

export default function ReplayViewScale({isLoading}: Props) {
  const {dimensions} = useReplayContext();
  const [{scale}] = useReplayPlayerSize();

  if (isLoading) {
    return <Placeholder width="20px" height="20px" />;
  }

  return (
    <Tooltip
      skipWrapper
      title={
        <CountTooltipContent>
          <dt>{t('Original size:')}</dt>
          <dd>
            {dimensions.width} &times; {dimensions.height}
          </dd>
          <dt>{t('Rendered size:')}</dt>
          <dd>{toPercent(scale, 1)}</dd>
        </CountTooltipContent>
      }
    >
      <IconWindow size="md" />
    </Tooltip>
  );
}
