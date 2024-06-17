import type {Event} from 'sentry/types/event';
import type ReplayReader from 'sentry/utils/replays/replayReader';
import type {ReplayFrame} from 'sentry/utils/replays/types';

export function getReplayDiffOffsetsFromFrame(
  replay: ReplayReader | null,
  frame: ReplayFrame
) {
  return {
    leftOffsetMs: frame.offsetMs,
    rightOffsetMs: Math.max(
      0,
      // `next.timestamp` is a timestamp since the unix epoch, so we remove the
      // replay start timestamp to get an offset
      (frame.data.mutations.next?.timestamp ?? 0) -
        (replay?.getReplay().started_at.getTime() ?? 0)
    ),
  };
}

export function getReplayDiffOffsetsFromEvent(replay: ReplayReader, event: Event) {
  const startTimestampMS =
    'startTimestamp' in event ? event.startTimestamp * 1000 : undefined;
  const timeOfEvent = event.dateCreated ?? startTimestampMS ?? event.dateReceived;
  const eventTimestampMs = timeOfEvent ? Math.floor(new Date(timeOfEvent).getTime()) : 0;
  // `event.dateCreated` is the most common date to use, and it's in seconds not ms

  const hydrationFrame = replay
    .getBreadcrumbFrames()
    .find(
      breadcrumb =>
        'category' in breadcrumb &&
        breadcrumb.category === 'replay.hydrate-error' &&
        breadcrumb.timestampMs > eventTimestampMs &&
        breadcrumb.timestampMs < eventTimestampMs + 1000
    );

  if (hydrationFrame) {
    return getReplayDiffOffsetsFromFrame(replay, hydrationFrame);
  }

  const frames = replay.getRRWebFrames();
  const replayStartTimestamp = replay?.getReplay().started_at.getTime() ?? 0;

  const leftReplayFrameIndex = replay
    .getRRWebFrames()
    .findIndex(frame => frame.timestamp < eventTimestampMs);
  const leftFrame = frames.at(Math.max(0, leftReplayFrameIndex));
  const leftOffsetMs = Math.max(0, replayStartTimestamp - (leftFrame?.timestamp ?? 0));

  const rightReplayFrameIndex = replay
    .getRRWebFrames()
    .findLastIndex(frame => frame.timestamp <= eventTimestampMs + 1);

  const rightFrame = frames.at(Math.min(frames.length, rightReplayFrameIndex + 1));
  const rightOffsetMs = Math.max(
    0,
    (rightFrame?.timestamp ?? eventTimestampMs) - replayStartTimestamp
  );

  return {leftOffsetMs, rightOffsetMs};
}
