import type {Frame as StacktraceFrame} from 'sentry/types/event';
import {Frame as ProfilingFrame} from 'sentry/utils/profiling/frame';

export interface StacktraceTreeNode {
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
  const nodes: Map<number, StacktraceTreeNode> = new Map();

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

  // Calculate depths via DFS
  function calculateDepth(node: StacktraceTreeNode, depth: number) {
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

/**
 * Calculates the maximum depth of the tree.
 */
export function getMaxDepth(roots: StacktraceTreeNode[]): number {
  let maxDepth = 0;

  function traverse(node: StacktraceTreeNode) {
    maxDepth = Math.max(maxDepth, node.depth);
    node.children.forEach(traverse);
  }

  roots.forEach(traverse);

  return maxDepth;
}

/**
 * Calculates the width of each node. Leaf nodes have width 1,
 * parent nodes have width = sum of children widths.
 */
export function calculateWidths(roots: StacktraceTreeNode[]): Map<number, number> {
  const widthMap = new Map<number, number>();

  function calculateWidth(node: StacktraceTreeNode): number {
    if (node.children.length === 0) {
      widthMap.set(node.frameIndex, 1);
      return 1;
    }

    const width = node.children.reduce((sum, child) => sum + calculateWidth(child), 0);
    widthMap.set(node.frameIndex, width);
    return width;
  }

  roots.forEach(root => calculateWidth(root));

  return widthMap;
}

/**
 * Calculates the total width of all root trees.
 */
export function getTotalWidth(
  roots: StacktraceTreeNode[],
  widthMap: Map<number, number>
): number {
  return roots.reduce((sum, root) => sum + (widthMap.get(root.frameIndex) ?? 1), 0);
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
 * Each unique path from root to leaf becomes a sample.
 * The sample is represented as an array of frame indices from root to leaf.
 * The weight for each sample comes from the leaf frame's sampleCount field.
 */
export function treeToSampledProfileData(roots: StacktraceTreeNode[]): {
  samples: number[][];
  weights: number[];
} {
  const samples: number[][] = [];
  const weights: number[] = [];

  function collectSamples(node: StacktraceTreeNode, currentPath: number[]) {
    const pathWithNode = [...currentPath, node.frameIndex];

    if (node.children.length === 0) {
      // This is a leaf node - add the path as a sample
      samples.push(pathWithNode);
      weights.push(node.frame.sampleCount ?? 1);
    } else {
      // Continue traversing children
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
