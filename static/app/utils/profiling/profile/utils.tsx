import {Span} from '@sentry/types';

import {defined} from 'sentry/utils';
import {Frame} from 'sentry/utils/profiling/frame';
import {ProfileGroup} from 'sentry/utils/profiling/profile/importProfile';
import {Profile} from 'sentry/utils/profiling/profile/profile';

import {CallTreeNode} from '../callTreeNode';

type FrameIndex = Record<string | number, Frame>;

export function createFrameIndex(
  frames: Profiling.Schema['shared']['frames']
): FrameIndex;
export function createFrameIndex(
  frames: JSSelfProfiling.Frame[],
  trace: JSSelfProfiling.Trace
): FrameIndex;
export function createFrameIndex(
  frames: Profiling.Schema['shared']['frames'] | JSSelfProfiling.Frame[],
  trace?: JSSelfProfiling.Trace
): FrameIndex {
  if (trace) {
    return (frames as JSSelfProfiling.Frame[]).reduce((acc, frame, index) => {
      acc[index] = new Frame(
        {
          key: index,
          resource:
            frame.resourceId !== undefined
              ? trace.resources[frame.resourceId]
              : undefined,
          ...frame,
        },
        'web'
      );
      return acc;
    }, {});
  }

  return (frames as Profiling.Schema['shared']['frames']).reduce((acc, frame, index) => {
    acc[index] = new Frame({
      key: index,
      ...frame,
    });
    return acc;
  }, {});
}

type Cache<Arguments extends ReadonlyArray<any> | any, Value> = {
  args: Arguments;
  value: Value;
};

export function memoizeByReference<Arguments, Value>(
  fn: (args: Arguments) => Value
): (t: Arguments) => Value {
  let cache: Cache<Arguments, Value> | null = null;

  return function memoizeByReferenceCallback(args: Arguments) {
    // If this is the first run then eval the fn and cache the result
    if (!cache) {
      cache = {args, value: fn(args)};
      return cache.value;
    }
    // If args match by reference, then return cached value
    if (cache.args === args && cache.args !== undefined && args !== undefined) {
      return cache.value;
    }

    // Else eval the fn and store the new value
    cache.args = args;
    cache.value = fn(args);
    return cache.value;
  };
}

export function memoizeVariadicByReference<Arguments, Value>(
  fn: (...args: ReadonlyArray<Arguments>) => Value
): (...t: ReadonlyArray<Arguments>) => Value {
  let cache: Cache<ReadonlyArray<Arguments>, Value> | null = null;

  return function memoizeByReferenceCallback(...args: ReadonlyArray<Arguments>) {
    // If this is the first run then eval the fn and cache the result
    if (!cache) {
      cache = {args, value: fn(...args)};
      return cache.value;
    }
    // If args match by reference, then return cached value
    if (
      cache.args.length === args.length &&
      cache.args.length !== 0 &&
      args.length !== 0 &&
      args.every((arg, i) => arg === cache?.args[i])
    ) {
      return cache.value;
    }

    // Else eval the fn and store the new value
    cache.args = args;
    cache.value = fn(...args);
    return cache.value;
  };
}

export function wrapWithSpan<T>(parentSpan: Span | undefined, fn: () => T, options): T {
  if (!defined(parentSpan)) {
    return fn();
  }

  const sentrySpan = parentSpan.startChild(options);
  try {
    return fn();
  } catch (error) {
    sentrySpan.setStatus('internal_error');
    throw error;
  } finally {
    sentrySpan.finish();
  }
}

export const isSystemCall = (node: CallTreeNode): boolean => {
  return !node.frame.is_application;
};

export const isApplicationCall = (node: CallTreeNode): boolean => {
  return !!node.frame.is_application;
};

type AnalyzeProfileResults = {
  slowestApplicationCalls: CallTreeNode[];
  slowestSystemCalls: CallTreeNode[];
};

export function getSlowestProfileCallsFromProfile(
  profile: Profile
): AnalyzeProfileResults {
  const applicationCalls: CallTreeNode[] = [];
  const systemFrames: CallTreeNode[] = [];

  const openFrame = (node: CallTreeNode) => {
    if (isSystemCall(node)) {
      systemFrames.push(node);
    } else {
      applicationCalls.push(node);
    }
  };

  const closeFrame = (_node: CallTreeNode) => {
    return;
  };

  profile.forEach(openFrame, closeFrame);

  const slowestApplicationCalls = applicationCalls.sort(
    (a, b) => b.selfWeight - a.selfWeight
  );
  const slowestSystemCalls = systemFrames.sort((a, b) => b.selfWeight - a.selfWeight);

  return {
    slowestApplicationCalls: slowestApplicationCalls.slice(0, 10),
    slowestSystemCalls: slowestSystemCalls.slice(0, 10),
  };
}

export function getSlowestProfileCallsFromProfileGroup(profileGroup: ProfileGroup) {
  const applicationCalls: Record<number, CallTreeNode[]> = {};
  const systemCalls: Record<number, CallTreeNode[]> = {};

  for (const profile of profileGroup.profiles) {
    const {slowestApplicationCalls, slowestSystemCalls} =
      getSlowestProfileCallsFromProfile(profile);

    applicationCalls[profile.threadId] = slowestApplicationCalls.splice(0, 10);
    systemCalls[profile.threadId] = slowestSystemCalls.splice(0, 10);
  }

  return {
    slowestApplicationCalls: applicationCalls,
    slowestSystemCalls: systemCalls,
  };
}
