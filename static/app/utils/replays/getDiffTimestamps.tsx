import type {Event} from 'sentry/types/event';
import type ReplayReader from 'sentry/utils/replays/replayReader';
import type {HydrationErrorFrame} from 'sentry/utils/replays/types';
import {isHydrationErrorFrame, isRRWebChangeFrame} from 'sentry/utils/replays/types';

type ReplayDiffOffsets = {
  frameOrEvent: HydrationErrorFrame | Event;
  leftOffsetMs: number;
  rightOffsetMs: number;
};

export function getReplayDiffOffsetsFromFrame(
  replay: ReplayReader | null,
  hydrationError: HydrationErrorFrame
): ReplayDiffOffsets {
  if (!replay) {
    return {
      frameOrEvent: hydrationError,
      leftOffsetMs: 0,
      rightOffsetMs: 0,
    };
  }

  const startTimestampMs = replay.getReplay().started_at.getTime() ?? 0;
  const domChangedFrames = replay.getRRWebFrames().filter(isRRWebChangeFrame);

  const prevIncremental = domChangedFrames.filter(
    frame => frame.timestamp < hydrationError.timestampMs
  );
  const nextIncremental = domChangedFrames.filter(
    frame => frame.timestamp > hydrationError.timestampMs
  );
  const leftFrame = prevIncremental.at(-1);
  const leftOffsetMs = Math.max(0, (leftFrame?.timestamp ?? 0) - startTimestampMs);
  const rightFrame = nextIncremental.at(1) ?? nextIncremental.at(0);
  const rightOffsetMs = Math.max(1, (rightFrame?.timestamp ?? 0) - startTimestampMs);

  return {
    frameOrEvent: hydrationError,
    leftOffsetMs,
    rightOffsetMs,
  };
}

export function getReplayDiffOffsetsFromEvent(
  replay: ReplayReader,
  event: Event
): ReplayDiffOffsets {
  const startTimestampMS =
    'startTimestamp' in event ? event.startTimestamp * 1000 : undefined;
  const timeOfEvent = event.dateCreated ?? startTimestampMS ?? event.dateReceived;
  const eventTimestampMs = timeOfEvent ? new Date(timeOfEvent).getTime() : 0;
  // `event.dateCreated` is the most common date to use, and it's in seconds not ms

  const hydrationFrame = replay
    .getBreadcrumbFrames()
    .findLast(
      (breadcrumb: any) =>
        isHydrationErrorFrame(breadcrumb) &&
        breadcrumb.timestampMs >= eventTimestampMs &&
        breadcrumb.timestampMs < eventTimestampMs + 1000
    );

  if (hydrationFrame && isHydrationErrorFrame(hydrationFrame)) {
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

  return {
    frameOrEvent: event,
    leftOffsetMs,
    rightOffsetMs,
  };
}
