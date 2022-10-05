import {Span} from '@sentry/types';

import {defined} from 'sentry/utils';
import {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import {Frame} from 'sentry/utils/profiling/frame';

import {CallTreeNode} from '../callTreeNode';

type FrameIndex = Record<string | number, Frame>;

export function createSentrySampleProfileFrameIndex(
  frames: Profiling.SentrySampledProfile['profile']['frames']
): FrameIndex {
  const frameIndex: FrameIndex = {};

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];

    frameIndex[i] = new Frame({
      key: i,
      name: frame.function ?? 'unknown',
      line: frame.lineno,
      column: frame.colno,
    });
  }

  return frameIndex;
}

export function createFrameIndex(
  type: 'mobile' | 'web',
  frames: Profiling.Schema['shared']['frames']
): FrameIndex;
export function createFrameIndex(
  type: 'mobile' | 'web',
  frames: JSSelfProfiling.Frame[],
  trace: JSSelfProfiling.Trace
): FrameIndex;
export function createFrameIndex(
  type: 'mobile' | 'web',
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
    acc[index] = new Frame(
      {
        key: index,
        ...frame,
      },
      type
    );
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

function indexNodeToParents(
  roots: FlamegraphFrame[],
  map: Record<string, FlamegraphFrame[]>,
  leafs: FlamegraphFrame[]
) {
  // Index each child node to its parent
  function indexNode(node: FlamegraphFrame, parent: FlamegraphFrame) {
    if (!map[node.key]) {
      map[node.key] = [];
    }

    map[node.key]!.push(parent); // we initialize this above

    if (!node.children.length) {
      leafs.push(node);
      return;
    }

    for (let i = 0; i < node.children.length; i++) {
      indexNode(node.children[i]!, node); // iterating over non empty array
    }
  }

  // Begin in each root node
  for (let i = 0; i < roots.length; i++) {
    // If the root is a leaf node, push it to the leafs array
    if (!roots[i].children?.length) {
      leafs.push(roots[i]);
    }

    // Init the map for the root in case we havent yet
    if (!map[roots[i].key]) {
      map[roots[i].key] = [];
    }

    // descend down to each child and index them
    for (let j = 0; j < roots[i].children.length; j++) {
      indexNode(roots[i].children[j], roots[i]);
    }
  }
}

function reverseTrail(
  nodes: FlamegraphFrame[],
  parentMap: Record<string, FlamegraphFrame[]>
): FlamegraphFrame[] {
  const splits: FlamegraphFrame[] = [];

  for (const n of nodes) {
    const nc = {
      ...n,
      parent: null as FlamegraphFrame | null,
      children: [] as FlamegraphFrame[],
    };

    const parents = parentMap[n.key];
    if (!parents) {
      continue;
    }

    for (const parent of parents) {
      nc.children.push(...reverseTrail([parent], parentMap));
    }
    splits.push(nc);
  }

  return splits;
}

export const invertCallTree = (roots: FlamegraphFrame[]): FlamegraphFrame[] => {
  const nodeToParentIndex: Record<string, FlamegraphFrame[]> = {};
  const leafNodes: FlamegraphFrame[] = [];

  indexNodeToParents(roots, nodeToParentIndex, leafNodes);
  const reversed = reverseTrail(leafNodes, nodeToParentIndex);
  return reversed;
};
