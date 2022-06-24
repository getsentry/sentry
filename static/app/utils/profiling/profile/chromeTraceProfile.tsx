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

function chronologicalSort(a: ChromeTrace.Event, b: ChromeTrace.Event): number {
  return a.ts - b.ts;
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

export function parseTypeScriptChromeTraceArrayFormat(
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
          type: 'typescript',
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

function isProfileEvent(event: ChromeTrace.Event): event is ChromeTrace.ProfileEvent {
  return event.ph === 'P' && event.name === 'Profile';
}

function isProfileChunk(
  event: ChromeTrace.Event
): event is ChromeTrace.ProfileChunkEvent {
  return event.ph === 'P' && event.name === 'ProfileChunk';
}

function isThreadmetaData(
  event: ChromeTrace.Event
): event is ChromeTrace.ThreadMetadataEvent {
  event.name === 'Thread';

  return event.ph === 'M' && event.name === 'Thread';
}

type Required<T> = {
  [P in keyof T]-?: T[P];
};

// This mostly follows what speedscope does for the Chrome Trace format, but we do minor adjustments (not sure if they are correct atm),
// but the protocol format seems out of date and is not well documented, so this is a best effort.
function collectEventsByProfile(input: ChromeTrace.ArrayFormat): {
  cpuProfiles: Map<string, Required<ChromeTrace.CpuProfile>>;
  threadNames: Map<string, string>;
} {
  const sorted = input.sort(chronologicalSort);

  const threadNames = new Map<string, string>();
  const profileIdToProcessAndThreadIds = new Map<string, [number, number]>();
  const cpuProfiles = new Map<string, Required<ChromeTrace.CpuProfile>>();

  for (let i = 0; i < sorted.length; i++) {
    const event = sorted[i];

    if (isThreadmetaData(event)) {
      threadNames.set(`${event.pid}:${event.tid}`, event.args.name);
      continue;
    }

    // A profile entry will happen before we see any ProfileChunks, so the order here matters
    if (isProfileEvent(event)) {
      profileIdToProcessAndThreadIds.set(event.id, [event.pid, event.tid]);

      if (cpuProfiles.has(event.id)) {
        continue;
      }

      // Judging by https://github.com/v8/v8/blob/b8626ca445554b8376b5a01f651b70cb8c01b7dd/src/inspector/js_protocol.json#L1453,
      // the only optional properties of a profile event are the samples and the timeDelta, however looking at a few sample traces
      // this does not seem to be the case. For example, in our chrometrace/trace.json there is a profile entry where only startTime is present
      cpuProfiles.set(event.id, {
        samples: [],
        timeDeltas: [],
        // @ts-ignore
        startTime: 0,
        // @ts-ignore
        endTime: 0,
        // @ts-ignore
        nodes: [],
        ...event.args.data,
      });

      continue;
    }

    if (isProfileChunk(event)) {
      const profile = cpuProfiles.get(event.id);

      if (!profile) {
        throw new Error('No entry for Profile was found before ProfileChunk');
      }

      // If we have a chunk, then append our values to it. Eventually we end up with a single profile with all of the chunks and samples merged
      const chunk = event.args.data;
      if (chunk.cpuProfile.nodes) {
        profile.nodes = profile.nodes.concat(chunk.cpuProfile.nodes ?? []);
      }
      if (chunk.cpuProfile.samples) {
        profile.samples = profile.samples.concat(chunk.cpuProfile.samples ?? []);
      }
      if (event.args.data.timeDeltas) {
        profile.timeDeltas = profile.timeDeltas.concat(chunk.timeDeltas ?? []);
      }
      if (chunk.startTime !== null && typeof chunk.startTime === 'number') {
        // Make sure we dont overwrite the startTime if it is already set
        if (typeof profile.startTime === 'number') {
          profile.startTime = Math.min(profile.startTime, chunk.startTime);
        } else {
          profile.startTime = chunk.startTime;
        }
      }
      // Make sure we dont overwrite the endTime if it is already set
      if (chunk.endTime !== null && typeof chunk.endTime === 'number') {
        if (typeof profile.endTime === 'number') {
          profile.endTime = Math.max(profile.endTime, chunk.endTime);
        } else {
          profile.endTime = chunk.endTime;
        }
      }
    }
    continue;
  }

  return {cpuProfiles, threadNames};
}

function createFramesIndex(
  profile: ChromeTrace.CpuProfile
): Map<number, ChromeTrace.ProfileNode> {
  const frames: Map<number, ChromeTrace.ProfileNode> = new Map();

  for (let i = 0; i < profile.nodes.length; i++) {
    frames.set(profile.nodes[i].id, profile.nodes[i]);
  }

  for (let i = 0; i < profile.nodes.length; i++) {
    const profileNode = profile.nodes[i];

    if (typeof profileNode.parent === 'number') {
      const parent = frames.get(profileNode.parent);

      if (parent === undefined) {
        throw new Error('Missing frame parent in profile');
      }

      profileNode.parent = parent;
    }

    if (!profileNode.children) {
      continue;
    }

    for (let j = 0; j < profileNode.children.length; j++) {
      const child = frames.get(profileNode.children[j]);

      if (child === undefined) {
        throw new Error('Missing frame child in profile');
      }

      child.parent = profileNode;
    }
  }

  return frames;
}

// Cpu profiles can often contain a lot of sequential samples that point to the same stack.
// It's wasteful to process these one by one, we can instead collapse them and just update the time delta.
// We should consider a similar approach for the backend sample storage. I expect we will remove
// this code from the frontend once we have backend support and a unified format for these.
// Effectively, samples like [1,1,2,1] and timedeltas [1,2,1,1] to sample [1,2,1] and timedeltas [3,1,1]
export function collapseSamples(profile: ChromeTrace.CpuProfile): {
  sampleTimes: number[];
  samples: number[];
} {
  const samples: number[] = [];
  const sampleTimes: number[] = [];

  // If we have no samples, then we can't collapse anything
  if (!profile.samples || !profile.samples.length) {
    throw new Error('Profile is missing samples');
  }

  // If we have no time deltas then the format may be corrupt
  if (!profile.timeDeltas || !profile.timeDeltas.length) {
    throw new Error('Profile is missing timeDeltas');
  }

  // If timedeltas does not match samples, then the format may be corrupt
  if (profile.timeDeltas.length !== profile.samples.length) {
    throw new Error("Profile's samples and timeDeltas don't match");
  }

  if (profile.samples.length === 1 && profile.timeDeltas.length === 1) {
    return {samples: [profile.samples[0]], sampleTimes: [profile.timeDeltas[0]]};
  }

  // First delta is relative to profile start
  // https://github.com/v8/v8/blob/44bd8fd7/src/inspector/js_protocol.json#L1485
  let elapsed: number = profile.timeDeltas[0];

  // This is quite significantly changed from speedscope's implementation.
  // We iterate over all samples and check if we can collapse them or not.
  // A sample should be collapsed when there are more that 2 consecutive samples
  // that are pointing to the same stack.
  for (let i = 0; i < profile.samples.length; i++) {
    const nodeId = profile.samples[i];

    // Initialize the delta to 0, so we can accumulate the deltas of any collapsed samples
    let delta = 0;
    // Start at i
    let j = i;
    // While we are not at the end and next sample is the same as current
    while (j < profile.samples.length && profile.samples[j + 1] === nodeId) {
      // Update the delta and advance j
      delta = Math.max(delta + profile.timeDeltas[j + 1], delta);
      j++;
    }

    // Check if we skipped more than 1 element
    if (j - i > 1) {
      // We skipped more than 1 element, so we should collapse the samples,
      // push the first element where we started with the elapsed time
      // and last element where we started with the elapsed time + delta
      samples.push(nodeId);
      sampleTimes.push(elapsed);
      samples.push(nodeId);
      sampleTimes.push(elapsed + delta);
      elapsed += delta;
      i = j;
    } else {
      // If we have not skipped samples, then we just push the sample and the delta to the list
      samples.push(nodeId);
      sampleTimes.push(elapsed);
      elapsed = Math.max(elapsed + profile.timeDeltas[i + 1], elapsed);
    }
  }
  return {samples, sampleTimes};
}

function shouldPlaceOnTopOfPreviousStack(_frame: ChromeTrace.CallFrame): boolean {
  return false;
}

function lastOf<T extends any[]>(arr: T): T[number] {
  return arr[arr.length - 1];
}

const callFrameToFrameInfo = new Map<ChromeTrace.CallFrame, Frame>();
function frameInfoForCallFrame(callFrame: ChromeTrace.CallFrame): Frame {
  const frame = callFrameToFrameInfo.get(callFrame);
  if (frame) {
    return frame;
  }

  const name = callFrame.functionName || '(anonymous)';

  return new Frame({
    key: `${name}:${callFrame.url}:${callFrame.lineNumber}:${callFrame.columnNumber}`,
    name,
    file: callFrame.url,
    line: callFrame.lineNumber,
    column: callFrame.columnNumber,
  });
}

// The following is taken from speedscope with minor changes to the logic - I'm adding some comments
// to explain what is happening so it's hopefully useful to others. To build a tree from a list of samples,
// we iterate over all samples while maintaining a stack. When each new sample is added, we find the common
// root node of the new sample and our stack. The difference between the new stack and the previous stack is
// the stack that we need to process. In case we encounter a common root between the two stacks, the stack frames of the new sample are
// added to the existing stack while the non common stack frames are closed off the stack. There are some
// special cases (engine events like gc, compile code etc) where frames are automatically added on top of the stack.
// This is similar to how JS self profiling frame markers work. When gc is on top of the sample, we do not close
// the samples, but instead append the gc frame to the top of the previous stack.
function createCallTree({
  cpuProfile,
  samples,
  sampleTimes,
  frameIndex,
}: {
  cpuProfile: ChromeTrace.CpuProfile;
  frameIndex: Map<number, ChromeTrace.ProfileNode>;
  sampleTimes: NonNullable<ChromeTrace.CpuProfile['timeDeltas']>;
  samples: NonNullable<ChromeTrace.CpuProfile['samples']>;
}): Profile {
  const profile = new ChromeTraceProfile(
    cpuProfile.endTime - cpuProfile.startTime,
    cpuProfile.startTime,
    cpuProfile.endTime,
    'thread',
    'microseconds',
    0
  );
  // Initialize an empty stack
  const prevStack: ChromeTrace.ProfileNode[] = [];

  for (let i = 0; i < samples.length; i++) {
    // Samples point at the top of the stack
    // https://github.com/v8/v8/blob/b8626ca445554b8376b5a01f651b70cb8c01b7dd/src/inspector/js_protocol.json#L1422
    const nodeId = samples[i];
    const stackTop = frameIndex.get(nodeId);

    if (!stackTop) {
      throw new Error(`Could not find frame ${nodeId} in frameIndex`);
    }

    // Check if we have a common node between the two stacks.
    // Start at the top of our new stack and descend down to the child of the common node.
    // until we find a node that is common between the two stacks. If a node is a special case
    // node, then set the common root to the top of the previous stack.
    let commonRoot: ChromeTrace.ProfileNode | null = stackTop || null;
    while (commonRoot && prevStack.indexOf(commonRoot) === -1) {
      if (shouldPlaceOnTopOfPreviousStack(commonRoot.callFrame)) {
        commonRoot = lastOf(prevStack);
        break;
      }
      commonRoot = commonRoot.parent || null;
    }

    // Walk down the stack until we find the common root and close the frames that
    // were on the previous stack but are not on the new stack.
    while (prevStack.length > 0 && lastOf(prevStack) !== commonRoot) {
      const closingNode = prevStack.pop()!;
      const frame = frameInfoForCallFrame(closingNode.callFrame);
      profile.leaveFrame(frame, sampleTimes[i]);
    }

    // Collect frames that are new and need to be opened.
    // This is the difference between the new stack and the previous stack.
    const toOpen: ChromeTrace.ProfileNode[] = [];

    // Start at the top and descend down to the common root.
    let start = stackTop;
    while (start && start !== commonRoot) {
      toOpen.push(start);
      start = shouldPlaceOnTopOfPreviousStack(start.callFrame)
        ? lastOf(prevStack)
        : start.parent;
    }

    // Since we pushed the frames in reverse order, we need to loop in reverse the order
    for (let j = toOpen.length - 1; j >= 0; j--) {
      profile.enterFrame(frameInfoForCallFrame(toOpen[j].callFrame), sampleTimes[i]);
      prevStack.push(toOpen[j]);
    }
  }

  // At the end of processing all samples, close any frames that may have been left open
  for (let i = prevStack.length - 1; i >= 0; i--) {
    profile.leaveFrame(
      frameInfoForCallFrame(prevStack[i].callFrame),
      lastOf(sampleTimes)
    );
  }

  return profile.build();
}

export function parseChromeTraceArrayFormat(
  input: ChromeTrace.ArrayFormat,
  traceID: string,
  _options?: ImportOptions
): ProfileGroup {
  const {cpuProfiles, threadNames: _threadNames} = collectEventsByProfile(input);
  const profiles: Profile[] = [];

  for (const [_profileId, profile] of cpuProfiles.entries()) {
    const index = createFramesIndex(profile);
    const {samples, sampleTimes} = collapseSamples(profile);

    profiles.push(
      createCallTree({
        cpuProfile: profile,
        frameIndex: index,
        sampleTimes,
        samples,
      })
    );
  }

  return {
    traceID,
    name: 'chrometrace',
    activeProfileIndex: 0,
    profiles,
  };
}
