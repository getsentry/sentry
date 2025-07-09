import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import formatDuration from 'sentry/utils/duration/formatDuration';
import {intervalToMilliseconds} from 'sentry/utils/duration/intervalToMilliseconds';
import {useReplayUserAction} from 'sentry/utils/replays/playback/providers/replayPlayerStateContext';

interface Props {
  intervals: string[];
}

export default function JumpToOffsetButtonBar({intervals}: Props) {
  const userAction = useReplayUserAction();

  return (
    <ButtonBar merged>
      {intervals.map(interval => {
        const intervalMs = intervalToMilliseconds(interval);
        return (
          <Button
            key={interval} redesign
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
