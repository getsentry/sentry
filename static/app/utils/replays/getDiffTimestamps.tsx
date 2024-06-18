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

  const replayStartTimestamp = replay?.getReplay().started_at.getTime() ?? 0;

  // Use the event timestamp for the left side.
  // Event has only second precision, therefore the hydration error happened
  // sometime after this timestamp.
  const leftOffsetMs = Math.max(0, eventTimestampMs - replayStartTimestamp);

  // Use the timestamp of the first mutation to happen after the timestamp of
  // the error event.
  const rightOffsetMs = Math.max(
    0,
    (replay.getRRWebMutations().find(frame => frame.timestamp > eventTimestampMs + 1000)
      ?.timestamp ?? eventTimestampMs) - replayStartTimestamp
  );

  return {leftOffsetMs, rightOffsetMs};
}
