import type {Span} from '@sentry/core';
import * as Sentry from '@sentry/react';

import {defined} from 'sentry/utils';
import type {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import {Frame} from 'sentry/utils/profiling/frame';

import type {CallTreeNode} from '../callTreeNode';

type FrameIndex = Record<string | number, Frame>;

export function createContinuousProfileFrameIndex(
  frames: Profiling.SentryContinousProfileChunk['profile']['frames'],
  platform: 'mobile' | 'node' | 'javascript' | string
): FrameIndex {
  const index: FrameIndex = {};
  const insertionCache: Record<string, Frame> = {};
  let idx = -1;

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i]!;
    const frameKey = `${frame.filename ?? ''}:${frame.function ?? 'unknown'}:${String(
      frame.lineno
    )}:${frame.instruction_addr ?? ''}`;

    const existing = insertionCache[frameKey];
    if (existing) {
      index[++idx] = existing;
      continue;
    }

    const f = new Frame(
      {
        key: i,
        is_application: frame.in_app,
        file: frame.filename,
        path: frame.abs_path,
        module: frame.module,
        package: frame.package,
        name: frame.function ?? 'unknown',
        line: frame.lineno,
        column: frame.colno ?? frame?.col ?? frame?.column,
        instructionAddr: frame.instruction_addr,
        symbol: frame.symbol,
        symbolAddr: frame.sym_addr,
        symbolicatorStatus: frame.status,
      },
      platform
    );
    index[++idx] = f;
    insertionCache[frameKey] = f;
  }

  return index;
}

export function createSentrySampleProfileFrameIndex(
  frames: Profiling.SentrySampledProfile['profile']['frames'],
  platform: 'mobile' | 'node' | 'javascript' | string
): FrameIndex {
  const index: FrameIndex = {};
  const insertionCache: Record<string, Frame> = {};
  let idx = -1;

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i]!;
    const frameKey = `${frame.filename ?? ''}:${frame.function ?? 'unknown'}:${String(
      frame.lineno
    )}:${frame.instruction_addr ?? ''}`;

    const existing = insertionCache[frameKey];
    if (existing) {
      index[++idx] = existing;
      continue;
    }

    const f = new Frame(
      {
        key: i,
        is_application: frame.in_app,
        file: frame.filename,
        path: frame.abs_path,
        module: frame.module,
        package: frame.package,
        name: frame.function ?? 'unknown',
        line: frame.lineno,
        column: frame.colno ?? frame?.col ?? frame?.column,
        instructionAddr: frame.instruction_addr,
        symbol: frame.symbol,
        symbolAddr: frame.sym_addr,
        symbolicatorStatus: frame.status,
      },
      platform
    );
    index[++idx] = f;
    insertionCache[frameKey] = f;
  }

  return index;
}

export function createFrameIndex(
  type: 'mobile' | 'node' | 'javascript',
  frames: Readonly<Profiling.Schema['shared']['frames']>
): FrameIndex;
export function createFrameIndex(
  type: 'mobile' | 'node' | 'javascript',
  frames: Readonly<JSSelfProfiling.Frame[]>,
  trace: Readonly<JSSelfProfiling.Trace>
): FrameIndex;
export function createFrameIndex(
  type: 'mobile' | 'node' | 'javascript',
  frames: Readonly<Profiling.Schema['shared']['frames'] | JSSelfProfiling.Frame[]>,
  trace?: Readonly<JSSelfProfiling.Trace>
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
        'javascript'
      );
      return acc;
    }, {});
  }

  return (frames as Profiling.Schema['shared']['frames']).reduce((acc, frame, index) => {
    acc[index] = new Frame(
      {
        key: index,
        column: frame.colno ?? frame?.col ?? frame?.column,
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

type Arguments<F extends Function> = F extends (...args: infer A) => any ? A : never;

export function memoizeVariadicByReference<T extends (...args) => V, V = ReturnType<T>>(
  fn: T
): (...t: Arguments<T>) => V {
  let cache: Cache<Arguments<T>, V> | null = null;

  return function memoizeByReferenceCallback(...args: Arguments<T>): V {
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

  return Sentry.withActiveSpan(parentSpan, () => {
    return Sentry.startSpan(options, () => {
      return fn();
    });
  });
}

export const isSystemCall = (node: CallTreeNode): boolean => {
  return !node.frame.is_application;
};

export const isApplicationCall = (node: CallTreeNode): boolean => {
  return !!node.frame.is_application;
};

function indexNodeToParents(
  roots: Readonly<FlamegraphFrame[]>,
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
    if (!roots[i]!.children?.length) {
      leafs.push(roots[i]!);
    }

    // Init the map for the root in case we havent yet
    if (!map[roots[i]!.key]) {
      map[roots[i]!.key] = [];
    }

    // descend down to each child and index them
    for (let j = 0; j < roots[i]!.children.length; j++) {
      indexNode(roots[i]!.children[j]!, roots[i]!);
    }
  }
}

function reverseTrail(
  nodes: Readonly<FlamegraphFrame[]>,
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

export const invertCallTree = (roots: Readonly<FlamegraphFrame[]>): FlamegraphFrame[] => {
  const nodeToParentIndex: Record<string, FlamegraphFrame[]> = {};
  const leafNodes: FlamegraphFrame[] = [];

  indexNodeToParents(roots, nodeToParentIndex, leafNodes);
  const reversed = reverseTrail(leafNodes, nodeToParentIndex);
  return reversed;
};

export function resolveFlamegraphSamplesProfileIds(
  samplesProfiles: Readonly<number[][]>,
  profileIds: Profiling.ProfileReference[]
): Profiling.ProfileReference[][] {
  return samplesProfiles.map(profileIdIndices => {
    return profileIdIndices.map(i => profileIds[i]!);
  });
}

interface SortableProfileSample {
  stack_id: number;
}

export function sortProfileSamples<S extends SortableProfileSample>(
  samples: Readonly<S[]>,
  stacks: Readonly<Profiling.SentrySampledProfile['profile']['stacks']>,
  frames: Readonly<Profiling.SentrySampledProfile['profile']['frames']>,
  frameFilter?: (i: number) => boolean
) {
  const frameIds = [...Array(frames.length).keys()].sort((a, b) => {
    const frameA = frames[a]!;
    const frameB = frames[b]!;

    if (defined(frameA.function) && defined(frameB.function)) {
      // sort alphabetically first
      const ret = frameA.function.localeCompare(frameB.function);
      if (ret !== 0) {
        return ret;
      }

      // break ties using the line number
      if (defined(frameA.lineno) && defined(frameB.lineno)) {
        return frameA.lineno - frameB.lineno;
      }

      if (defined(frameA.lineno)) {
        return -1;
      }

      if (defined(frameB.lineno)) {
        return 1;
      }
    } else if (defined(frameA.function)) {
      // if only frameA is defined, it goes first
      return -1;
    } else if (defined(frameB.function)) {
      // if only frameB is defined, it goes first
      return 1;
    }

    // if neither functions are defined, they're treated as equal
    return 0;
  });

  const framesMapping = frameIds.reduce((acc, frameId, idx) => {
    acc[frameId] = idx;
    return acc;
  }, {});

  return [...samples].sort((a, b) => {
    // same stack id, these are the same
    if (a.stack_id === b.stack_id) {
      return 0;
    }

    const stackA = frameFilter
      ? stacks[a.stack_id].filter(frameFilter)
      : stacks[a.stack_id];
    const stackB = frameFilter
      ? stacks[b.stack_id].filter(frameFilter)
      : stacks[b.stack_id];

    const minDepth = Math.min(stackA.length, stackB.length);

    for (let i = 0; i < minDepth; i++) {
      // we iterate from the end of each stack because that's where the main function is
      const frameIdA = stackA[stackA.length - i - 1];
      const frameIdB = stackB[stackB.length - i - 1];

      // same frame id, so check the next frame in the stack
      if (frameIdA === frameIdB) {
        continue;
      }

      const frameIdxA = framesMapping[frameIdA];
      const frameIdxB = framesMapping[frameIdB];

      // same frame idx, so check the next frame in the stack
      if (frameIdxA === frameIdxB) {
        continue;
      }

      return frameIdxA - frameIdxB;
    }

    // if all frames up to the depth of the shorter stack matches,
    // then the deeper stack goes first
    return stackB.length - stackA.length;
  });
}
