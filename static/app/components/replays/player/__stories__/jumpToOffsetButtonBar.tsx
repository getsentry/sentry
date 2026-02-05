import {Button, ButtonBar} from '@sentry/scraps/button';

import formatDuration from 'sentry/utils/duration/formatDuration';
import {intervalToMilliseconds} from 'sentry/utils/duration/intervalToMilliseconds';
import {useReplayUserAction} from 'sentry/utils/replays/playback/providers/replayPlayerStateContext';

interface Props {
  intervals: string[];
}

export default function JumpToOffsetButtonBar({intervals}: Props) {
  const userAction = useReplayUserAction();

  return (
    <ButtonBar merged gap="0">
      {intervals.map(interval => {
        const intervalMs = intervalToMilliseconds(interval);
        return (
          <Button
            key={interval}
            onClick={() => userAction({type: 'jumpToOffset', offsetMs: intervalMs})}
            size="sm"
          >
            {formatDuration({
              duration: [intervalMs, 'ms'],
              style: 'h:mm:ss.sss',
              precision: 'ms',
            })}
          </Button>
        );
      })}
    </ButtonBar>
  );
}
