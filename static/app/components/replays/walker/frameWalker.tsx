import {memo} from 'react';

import ChevronDividedList from 'sentry/components/replays/walker/chevronDividedList';
import splitCrumbs from 'sentry/components/replays/walker/splitCrumbs';
import useCrumbHandlers from 'sentry/utils/replays/hooks/useCrumbHandlers';
import type {ReplayFrame} from 'sentry/utils/replays/types';
import type {ReplayRecord} from 'sentry/views/replays/types';

type Props = {
  frames: ReplayFrame[];
  replayRecord: ReplayRecord;
};

const FrameWalker = memo(function FrameWalker({frames, replayRecord}: Props) {
  const startTimestampMs = replayRecord.started_at.getTime();
  const {handleClick} = useCrumbHandlers(startTimestampMs);

  return (
    <ChevronDividedList
      items={splitCrumbs({
        frames,
        startTimestampMs,
        onClick: handleClick,
      })}
    />
  );
});

export default FrameWalker;
