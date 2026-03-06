import type {Frame as StacktraceFrame} from 'sentry/types/event';
import {Frame as ProfilingFrame} from 'sentry/utils/profiling/frame';

interface StacktraceTreeNode {
  children: StacktraceTreeNode[];
  depth: number;
  frame: StacktraceFrame;
  frameIndex: number;
  parent: StacktraceTreeNode | null;
}

/**
 * Builds a tree structure from a flat array of frames using the parentIndex field
 * to establish parent-child relationships. parentIndex contains the index of the
 * parent frame, or -1 for root frames.
 */
export function buildFrameTree(frames: StacktraceFrame[]): StacktraceTreeNode[] {
  // Create nodes for each frame
  const nodes = new Map<number, StacktraceTreeNode>();

  frames.forEach((frame, index) => {
    nodes.set(index, {
      frame,
      frameIndex: index,
      children: [],
      parent: null,
      depth: 0,
    });
  });

  // Build parent-child relationships
  const roots: StacktraceTreeNode[] = [];

  frames.forEach((frame, index) => {
    const node = nodes.get(index)!;
    // parentIndex contains the parent frame index. -1 means root frame.
    const parentIndex = frame.parentIndex;

    if (
      parentIndex !== null &&
      parentIndex !== undefined &&
      parentIndex !== -1 &&
      nodes.has(parentIndex) &&
      parentIndex !== index // Prevent self-reference
    ) {
      const parent = nodes.get(parentIndex)!;
      node.parent = parent;
      parent.children.push(node);
    } else {
      // No valid parent (parentIndex is -1 or invalid) - this is a root node
      roots.push(node);
    }
  });

  // Calculate depths via DFS, tracking visited nodes to avoid cycles
  const visited = new Set<number>();
  function calculateDepth(node: StacktraceTreeNode, depth: number) {
    if (visited.has(node.frameIndex)) {
      return;
    }
    visited.add(node.frameIndex);
    node.depth = depth;
    node.children.forEach(child => calculateDepth(child, depth + 1));
  }

  roots.forEach(root => calculateDepth(root, 0));

  return roots;
}

/**
 * Checks if the stacktrace frames contain flamegraph data.
 * Flamegraph data is present when frames have parentIndex values set.
 */
export function hasFlamegraphData(frames: StacktraceFrame[] | undefined): boolean {
  if (!frames || frames.length === 0) {
    return false;
  }

  // Flamegraph data is present when parentIndex is set (not null/undefined).
  return frames.some(
    frame => frame.parentIndex !== null && frame.parentIndex !== undefined
  );
}

type FrameIndex = Record<string | number, ProfilingFrame>;

/**
 * Converts stacktrace frames to profiling Frame objects and creates a frame index.
 */
export function createStacktraceFrameIndex(frames: StacktraceFrame[]): FrameIndex {
  const index: FrameIndex = {};

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i]!;
    index[i] = new ProfilingFrame(
      {
        key: i,
        is_application: frame.inApp ?? false,
        file: frame.filename ?? undefined,
        path: frame.absPath ?? undefined,
        module: frame.module ?? undefined,
        package: frame.package ?? undefined,
        name: frame.function ?? frame.filename ?? '<unknown>',
      },
      'mobile'
    );
  }

  return index;
}

/**
 * Converts the stacktrace tree structure to samples and weights format
 * suitable for creating a SampledProfile.
 *
 * Each unique path from root to a sampled frame becomes a sample.
 * The sample is represented as an array of frame indices from root to that frame.
 * Non-leaf frames with a sampleCount emit a self-sample in addition to
 * recursing into children, capturing samples where that frame was at the
 * top of the stack.
 */
export function treeToSampledProfileData(roots: StacktraceTreeNode[]): {
  samples: number[][];
  weights: number[];
} {
  const samples: number[][] = [];
  const weights: number[] = [];
  const visited = new Set<number>();

  function collectSamples(node: StacktraceTreeNode, currentPath: number[]) {
    if (visited.has(node.frameIndex)) {
      return;
    }
    visited.add(node.frameIndex);
    const pathWithNode = [...currentPath, node.frameIndex];
    const inclusiveCount = node.frame.sampleCount ?? 0;

    if (node.children.length === 0) {
      if (inclusiveCount > 0) {
        samples.push(pathWithNode);
        weights.push(inclusiveCount);
      }
    } else {
      // Self weight = inclusive count minus children's inclusive counts
      const childrenCount = node.children.reduce(
        (sum, child) => sum + (child.frame.sampleCount ?? 0),
        0
      );
      const selfCount = inclusiveCount - childrenCount;

      if (selfCount > 0) {
        samples.push(pathWithNode);
        weights.push(selfCount);
      }

      for (const child of node.children) {
        collectSamples(child, pathWithNode);
      }
    }
  }

  for (const root of roots) {
    collectSamples(root, []);
  }

  return {samples, weights};
}
