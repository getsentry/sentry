import {useReplayReader} from 'sentry/utils/replays/playback/providers/replayReaderProvider';

import {NewTraceView} from './trace';

export function TraceFeature() {
  const replay = useReplayReader();

  return <NewTraceView replay={replay?.getReplay()} />;
}
