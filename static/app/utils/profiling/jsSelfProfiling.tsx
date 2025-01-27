import {stackMarkerToHumanReadable} from './formatters/stackMarkerToHumanReadable';
import {Frame} from './frame';

function createMarkerFrame(marker: JSSelfProfiling.Marker): JSSelfProfiling.Frame {
  return {
    name: stackMarkerToHumanReadable(marker),
    resourceId: undefined,
    line: undefined,
    column: undefined,
  };
}
/**
 * Utility fn to resolve stack frames starting from the top most frame.
 * Each frame points to its parent, with the initial stackId pointer pointing to the top of the frame.
 * We walk down the stack until no more frames are found, appending the parent frame to the list.
 * As a result we end up with a list of frames starting from the root most frame.
 *
 * There is a caching opportunity here, as stackId's point to the same parts of the stack, resolving it once is sufficient
 * and all subsequent calls could be cached. Some instrumentation and testing would be required, leaving as is for now.
 */
export function resolveJSSelfProfilingStack(
  trace: JSSelfProfiling.Trace,
  stackId: JSSelfProfiling.Sample['stackId'],
  frameIndex: Record<number, Frame>,
  marker?: JSSelfProfiling.Marker
): Frame[] {
  // If there is no stack associated with a sample, it means the thread was idle
  const callStack: Frame[] = [];

  // There can only be one marker per callStack, so prepend it to the start of the stack
  if (marker && marker !== 'script') {
    callStack.unshift(new Frame({...createMarkerFrame(marker), key: marker}));
  }

  if (stackId === undefined) {
    return callStack;
  }

  let stack: JSSelfProfiling.Stack | undefined = trace.stacks[stackId];

  // If the stackId cannot be resolved from the stacks dict, it means the format is corrupt or partial (possibly due to termination reasons).
  // This should never happen, but in the offchance that it somehow does, it should be handled.
  if (!stack) {
    throw new Error(`Missing stackId ${stackId} in trace, cannot resolve stack`);
  }

  while (stack !== undefined) {
    // If the frameId pointer cannot be resolved, it means the format is corrupt or partial (possibly due to termination reasons).
    // This should never happen, but in the offchance that it somehow does, it should be handled.
    if (trace.frames[stack.frameId] === undefined) {
      return callStack;
    }

    callStack.unshift(frameIndex[stack.frameId]!);

    if (stack.parentId !== undefined) {
      stack = trace.stacks[stack.parentId];
    } else {
      stack = undefined;
    }
  }

  return callStack;
}
