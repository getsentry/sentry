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
    const frameKey = `${frame.filename ?? ''}:${frame.function ?? 'unknown'}:${
      String(frame.lineno) ?? ''
    }:${frame.instruction_addr ?? ''}`;

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
    const frameKey = `${frame.filename ?? ''}:${frame.function ?? 'unknown'}:${
      String(frame.lineno) ?? ''
    }:${frame.instruction_addr ?? ''}`;

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
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
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
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
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

export function memoizeVariadicByReference<
  T extends (...args: any[]) => V,
  V = ReturnType<T>,
>(fn: T): (...t: Arguments<T>) => V {
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

export function wrapWithSpan<T>(
  parentSpan: Span | undefined,
  fn: () => T,
  options: any
): T {
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
