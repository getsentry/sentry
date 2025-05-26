import {type Replayer} from '@sentry-internal/rrweb';

import type {RecordingFrame, ReplayFrame} from 'sentry/utils/replays/types';

import {createHiddenPlayer} from './createHiddenPlayer';

interface DomQueryArgs<Frame extends ReplayFrame | RecordingFrame, CollectionData> {
  onVisitFrame: (
    frame: Frame,
    collection: Map<Frame, CollectionData>,
    replayer: Replayer
  ) => void;
  rrwebEvents: RecordingFrame[] | undefined;
  startTimestampMs: number;
}
export function replayerDomQuery<
  Frame extends ReplayFrame | RecordingFrame,
  CollectionData,
>({onVisitFrame, rrwebEvents, startTimestampMs}: DomQueryArgs<Frame, CollectionData>) {
  const collection = new Map<Frame, CollectionData>();

  if (!rrwebEvents?.length) {
    return null;
  }

  const {replayer} = createHiddenPlayer(rrwebEvents);

  return {
    getResult: (frame: Frame): CollectionData | null => {
      if (collection.has(frame)) {
        return collection.get(frame) ?? null;
      }

      // Fetch result
      const timestamp =
        'offsetMs' in frame ? frame.offsetMs : frame.timestamp - startTimestampMs;
      replayer.pause(timestamp);
      onVisitFrame(frame, collection, replayer);
      return collection.get(frame) ?? null;
    },
  };
}
