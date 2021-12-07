/**
 * Utility fn to resolve stack frames starting from the top most frame.
 * Each frame points to it's parent, with the initial stackId pointer pointing to the top of the frame.
 * We walk down the stack until no more frames are found, appending the parent frame to the list.
 * As a result we end up with a list of frames starting from the root most frame.
 *
 * There is a caching opportunity here, as stackId's point to the same parts of the stack, resolving it once is sufficient
 * and all subsequent calls could be cached. Some instrumentation and testing would be required, leaving as is for now.
 */
export function resolveJSSelfProfilingStack(
  trace: JSSelfProfiling.Trace,
  stackId: JSSelfProfiling.Sample['stackId'],
  frameIndex: Record<string, JSSelfProfiling.Frame>,
  marker?: JSSelfProfiling.Marker
): JSSelfProfiling.Frame[] {
  // If there is no stack associated with a sample, it means the thread was idle
  if (stackId === undefined) return [];

  const stack: JSSelfProfiling.Frame[] = [];

  // There can only be one marker per stack, so prepend it to the start of the stack
  if (marker && marker !== 'script') {
    const current = frameIndex[marker];
    stack.unshift(current);
  }

  let node: JSSelfProfiling.Stack | undefined = trace.stacks[stackId];

  // If the stackId cannot be resolved from the stacks dict, it means the format is corrupted - this should never happen.
  if (!node) throw new Error(`Missing stackId ${stackId} in trace, cannot resolve stack`);

  while (node) {
    const current = frameIndex[node.frameId];
    stack.unshift(current);

    if (node.parentId) {
      node = trace.stacks[node.parentId];
    } else {
      node = undefined;
    }
  }

  return stack;
}
