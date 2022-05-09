/**
 * The import code is very similar to speedscope's import code. The queue approach works well and allows us
 * to easily split the X events and handle them. There are some small differences when it comes to building
 * profiles where we opted to throw instead of closing a frame that was never opened.
 *
 * Overall, it seems that mostly typescript compiler uses this output, so we could possibly do a bit more
 * in order to detect if this is a tsc trace and mark the different compiler phases and give users the preference
 * to color encode by the program/bind/check/emit phases.
 */
import {Frame} from 'sentry/utils/profiling/frame';
import {Profile} from 'sentry/utils/profiling/profile/profile';
import {wrapWithSpan} from 'sentry/utils/profiling/profile/utils';

import {EventedProfile} from './eventedProfile';
import {ImportOptions, ProfileGroup} from './importProfile';

export class ChromeTraceProfile extends EventedProfile {}

type ProcessId = number;
type ThreadId = number;

export function splitEventsByProcessAndTraceId(
  trace: ChromeTrace.ArrayFormat
): Map<ProcessId, Map<ThreadId, ChromeTrace.Event[]>> {
  const collections: Map<ProcessId, Map<ThreadId, ChromeTrace.Event[]>> = new Map();

  for (let i = 0; i < trace.length; i++) {
    const event = trace[i];

    if (typeof event.pid !== 'number') {
      continue;
    }
    if (typeof event.tid !== 'number') {
      continue;
    }

    let processes = collections.get(event.pid);
    if (!processes) {
      processes = new Map();
      collections.set(event.pid, processes);
    }

    let threads = processes.get(event.tid);
    if (!threads) {
      threads = [];
      processes.set(event.tid, threads);
    }

    threads.push(event);
  }

  return collections;
}

function reverseChronologicalSort(a: ChromeTrace.Event, b: ChromeTrace.Event): number {
  return b.ts - a.ts;
}

function getNextQueue(
  beginQueue: ChromeTrace.Event[],
  endQueue: ChromeTrace.Event[]
): 'B' | 'E' {
  if (!beginQueue.length && !endQueue.length) {
    throw new Error('Profile contains no events');
  }

  const nextBegin = beginQueue[beginQueue.length - 1];
  const nextEnd = endQueue[endQueue.length - 1];

  if (!nextEnd) {
    return 'B';
  }
  if (!nextBegin) {
    return 'E';
  }
  if (nextBegin.ts < nextEnd.ts) {
    return 'B';
  }
  if (nextEnd.ts < nextBegin.ts) {
    return 'E';
  }
  return 'B';
}

function buildProfile(
  processId: number,
  threadId: number,
  events: ChromeTrace.Event[]
): ChromeTraceProfile {
  let processName: string = `pid (${processId})`;
  let threadName: string = `tid (${threadId})`;

  // We dont care about other events besides begin, end, instant events and metadata events
  const timelineEvents = events.filter(
    e => e.ph === 'B' || e.ph === 'E' || e.ph === 'X' || e.ph === 'M'
  );

  const beginQueue: Array<ChromeTrace.Event> = [];
  const endQueue: Array<ChromeTrace.Event> = [];

  for (let i = 0; i < timelineEvents.length; i++) {
    const event = timelineEvents[i];

    // M events are not pushed to the queue, we just store their information
    if (event.ph === 'M') {
      if (event.name === 'thread_name' && typeof event.args.name === 'string') {
        threadName = `${event.args.name} (${threadId})`;
        continue;
      }

      if (event.name === 'process_name' && typeof event.args.name === 'string') {
        processName = `${event.args.name} (${processId})`;
        continue;
      }
    }

    // B, E and X events are pushed to the timeline. We transform all X events into
    // B and E event, so that they can be pushed onto the queue and handled
    if (event.ph === 'B') {
      beginQueue.push(event);
      continue;
    }

    if (event.ph === 'E') {
      endQueue.push(event);
      continue;
    }

    if (event.ph === 'X') {
      if (typeof event.dur === 'number' || typeof event.tdur === 'number') {
        beginQueue.push({...event, ph: 'B'});
        endQueue.push({...event, ph: 'E', ts: event.ts + (event.dur ?? event.tdur ?? 0)});
        continue;
      }
    }
  }

  beginQueue.sort(reverseChronologicalSort);
  endQueue.sort(reverseChronologicalSort);

  if (!beginQueue.length) {
    throw new Error('Profile does not contain any frame events');
  }

  const firstTimestamp = beginQueue[beginQueue.length - 1].ts;
  const lastTimestamp = endQueue[0]?.ts ?? beginQueue[0].ts;

  if (typeof firstTimestamp !== 'number') {
    throw new Error('First begin event contains no timestamp');
  }

  if (typeof lastTimestamp !== 'number') {
    throw new Error('Last end event contains no timestamp');
  }

  const profile = new ChromeTraceProfile(
    lastTimestamp - firstTimestamp,
    firstTimestamp,
    lastTimestamp,
    `${processName}: ${threadName}`,
    'microseconds', // the trace event format provides timestamps in microseconds
    threadId
  );

  const stack: ChromeTrace.Event[] = [];
  const frameCache = new Map<string, Frame>();

  while (beginQueue.length > 0 || endQueue.length > 0) {
    const next = getNextQueue(beginQueue, endQueue);

    if (next === 'B') {
      const item = beginQueue.pop();
      if (!item) {
        throw new Error('Nothing to take from begin queue');
      }

      const frameInfo = createFrameInfoFromEvent(item);

      if (!frameCache.has(frameInfo.key)) {
        frameCache.set(frameInfo.key, new Frame(frameInfo));
      }

      const frame = frameCache.get(frameInfo.key)!;
      profile.enterFrame(frame, item.ts - firstTimestamp);
      stack.push(item);
      continue;
    }

    if (next === 'E') {
      const item = endQueue.pop()!;
      let frameInfo = createFrameInfoFromEvent(item);

      if (stack[stack.length - 1] === undefined) {
        throw new Error(
          `Unable to close frame from an empty stack, attempting to close ${JSON.stringify(
            item
          )}`
        );
      }
      const topFrameInfo = createFrameInfoFromEvent(stack[stack.length - 1]);

      // We check frames with the same ts and look for a match. We do this because
      // chronological sort will not break ties on frames that end at the same time,
      // but may not be in the same order as they were opened.
      for (let i = endQueue.length - 2; i > 0; i--) {
        if (endQueue[i].ts > endQueue[endQueue.length - 1].ts) {
          break;
        }

        const nextEndInfo = createFrameInfoFromEvent(endQueue[i]);
        if (topFrameInfo.key === nextEndInfo.key) {
          const tmp = endQueue[endQueue.length - 1];
          endQueue[endQueue.length - 1] = endQueue[i];
          endQueue[i] = tmp;

          frameInfo = nextEndInfo;
          break;
        }
      }

      if (!frameCache.has(frameInfo.key)) {
        throw new Error(
          `Cannot leave frame that was never entered, leaving ${frameInfo.key}`
        );
      }

      const frame = frameCache.get(frameInfo.key)!;
      profile.leaveFrame(frame, item.ts - firstTimestamp);
      stack.pop();
      continue;
    }
  }

  // Close the leftover frames in stack
  while (stack.length) {
    const item = stack.pop()!;
    const frameInfo = createFrameInfoFromEvent(item);

    const frame = frameCache.get(frameInfo.key);
    if (!frame) {
      throw new Error(
        `Cannot leave frame that was never entered, leaving ${frameInfo.key}`
      );
    }
    profile.leaveFrame(frame, frame.totalWeight);
  }

  return profile.build();
}

function createFrameInfoFromEvent(event: ChromeTrace.Event) {
  const key = JSON.stringify(event.args);

  return {
    key,
    name: `${event?.name || 'Unknown'} ${key}`.trim(),
  };
}

export function parseChromeTraceArrayFormat(
  input: ChromeTrace.ArrayFormat,
  traceID: string,
  options?: ImportOptions
): ProfileGroup {
  const profiles: Profile[] = [];
  const eventsByProcessAndThreadID = splitEventsByProcessAndTraceId(input);

  for (const [processId, threads] of eventsByProcessAndThreadID) {
    for (const [threadId, events] of threads) {
      wrapWithSpan(
        options?.transaction,
        () => profiles.push(buildProfile(processId, threadId, events ?? [])),
        {
          op: 'profile.import',
          description: 'chrometrace',
        }
      );
    }
  }

  return {
    name: 'chrometrace',
    traceID,
    activeProfileIndex: 0,
    profiles,
  };
}
