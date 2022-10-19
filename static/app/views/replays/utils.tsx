import {relativeTimeInMs} from 'sentry/components/replays/utils';
import {defined} from 'sentry/utils';

export const getInitialTimeOffset = ({
  eventTimestamp,
  initialTimeOffset,
  startTimestampMs,
}: {
  eventTimestamp?: string;
  initialTimeOffset?: number;
  startTimestampMs?: number;
}) => {
  if (defined(initialTimeOffset)) {
    return initialTimeOffset;
  }

  // If the user has navigated to the replay from an event, then we want to
  // start the video at the time of the event.
  if (defined(eventTimestamp) && defined(startTimestampMs)) {
    // check if the event timestamp is the correct format
    let eventTimestampMs = 0;
    if (eventTimestamp.length === 13) {
      eventTimestampMs = Number(eventTimestamp);
    } else {
      eventTimestampMs = new Date(eventTimestamp).getTime();
    }

    // check if our event timestamp is within the range of the replay
    if (eventTimestampMs >= startTimestampMs) {
      initialTimeOffset = relativeTimeInMs(eventTimestampMs, startTimestampMs) / 1000;
    }
  }

  // if the event timestamp is not the correct format or no timestamps are provided, default to the start of the replay
  if (!defined(initialTimeOffset) || Number.isNaN(initialTimeOffset)) {
    initialTimeOffset = 0;
  }

  return initialTimeOffset;
};
