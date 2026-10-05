import {t} from 'sentry/locale';
import {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import {Frame} from 'sentry/utils/profiling/frame';
import {SampledProfile} from 'sentry/utils/profiling/profile/sampledProfile';

export type FlamegraphAttachmentFrame = Omit<
  Profiling.SentrySampledProfileFrame,
  'in_app'
> & {
  in_app?: boolean;
};

export type FlamegraphAttachmentNode = {
  frame_id: number;
  sample_count: number;
  children?: FlamegraphAttachmentNode[];
};

export type FlamegraphAttachmentTree = {
  roots: FlamegraphAttachmentNode[];
  thread_attributed?: boolean;
  thread_id?: string;
};

export type FlamegraphAttachmentData = {
  frames: FlamegraphAttachmentFrame[];
  platform: string;
  trees: FlamegraphAttachmentTree[];
  version: '1';
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseFlamegraphAttachment(value: unknown): FlamegraphAttachmentData {
  let payload: unknown = value;
  if (typeof value === 'string') {
    try {
      payload = JSON.parse(value);
    } catch {
      throw new Error(t('The flamegraph attachment is not valid JSON.'));
    }
  }
  if (!isRecord(payload)) {
    throw new Error(t('The flamegraph attachment has an unsupported format.'));
  }
  if (payload.version !== '1') {
    throw new Error(t('This flamegraph attachment version is not supported.'));
  }
  if (
    typeof payload.platform !== 'string' ||
    !Array.isArray(payload.frames) ||
    !payload.frames.length ||
    !Array.isArray(payload.trees) ||
    !payload.trees.length
  ) {
    throw new Error(t('The flamegraph attachment is missing frames or call trees.'));
  }
  for (const frame of payload.frames) {
    if (
      !isRecord(frame) ||
      !['function', 'filename', 'instruction_addr'].some(
        field => typeof frame[field] === 'string' && frame[field]
      ) ||
      [
        'function',
        'filename',
        'instruction_addr',
        'abs_path',
        'module',
        'package',
        'platform',
        'symbol',
        'sym_addr',
      ].some(field => frame[field] !== undefined && typeof frame[field] !== 'string') ||
      (frame.in_app !== undefined && typeof frame.in_app !== 'boolean') ||
      ['lineno', 'colno'].some(
        field => frame[field] !== undefined && !Number.isSafeInteger(frame[field])
      )
    ) {
      throw new Error(t('The flamegraph attachment contains invalid frames.'));
    }
  }
  for (const tree of payload.trees) {
    if (
      !isRecord(tree) ||
      !Array.isArray(tree.roots) ||
      !tree.roots.length ||
      (tree.thread_id !== undefined && typeof tree.thread_id !== 'string') ||
      (tree.thread_attributed !== undefined &&
        typeof tree.thread_attributed !== 'boolean')
    ) {
      throw new Error(t('The flamegraph attachment contains invalid call trees.'));
    }
    const nodes: unknown[] = [...tree.roots];
    while (nodes.length) {
      const node = nodes.pop();
      if (
        !isRecord(node) ||
        typeof node.frame_id !== 'number' ||
        !Number.isSafeInteger(node.frame_id) ||
        node.frame_id < 0 ||
        node.frame_id >= payload.frames.length ||
        typeof node.sample_count !== 'number' ||
        !Number.isSafeInteger(node.sample_count) ||
        node.sample_count <= 0
      ) {
        throw new Error(
          t(
            'The flamegraph attachment contains invalid sample counts or frame references.'
          )
        );
      }
      const children = node.children === undefined ? [] : node.children;
      if (!Array.isArray(children)) {
        throw new Error(t('The flamegraph attachment contains invalid call trees.'));
      }
      let childrenCount = 0;
      for (const child of children) {
        if (
          !isRecord(child) ||
          typeof child.sample_count !== 'number' ||
          !Number.isSafeInteger(child.sample_count) ||
          child.sample_count <= 0
        ) {
          throw new Error(t('The flamegraph attachment contains invalid sample counts.'));
        }
        childrenCount += child.sample_count;
      }
      if (childrenCount > node.sample_count) {
        throw new Error(
          t('Child sample counts exceed their parent in the flamegraph attachment.')
        );
      }
      nodes.push(...children);
    }
  }
  return payload as FlamegraphAttachmentData;
}

export function treeToSamples(tree: FlamegraphAttachmentTree): {
  samples: number[][];
  weights: number[];
} {
  const samples: number[][] = [];
  const weights: number[] = [];
  const pending = tree.roots.map(node => ({node, path: [] as number[]})).reverse();
  while (pending.length) {
    const {node, path} = pending.pop()!;
    const currentPath = [...path, node.frame_id];
    const children = node.children ?? [];
    const selfCount =
      node.sample_count - children.reduce((sum, child) => sum + child.sample_count, 0);
    if (selfCount > 0) {
      samples.push(currentPath);
      weights.push(selfCount);
    }
    for (let index = children.length - 1; index >= 0; index--) {
      pending.push({node: children[index]!, path: currentPath});
    }
  }
  return {samples, weights};
}

export function createFlamegraph(
  data: FlamegraphAttachmentData,
  treeIndex: number
): Flamegraph {
  const frameIndex: Record<number, Frame> = {};
  data.frames.forEach((frame, index) => {
    frameIndex[index] = new Frame(
      {
        key: index,
        name:
          frame.function || frame.filename || frame.instruction_addr || t('<unknown>'),
        is_application: frame.in_app ?? false,
        file: frame.filename,
        path: frame.abs_path,
        line: frame.lineno,
        column: frame.colno,
        module: frame.module,
        package: frame.package,
        platform: frame.platform ?? data.platform,
        instructionAddr: frame.instruction_addr,
        symbol: frame.symbol,
        symbolAddr: frame.sym_addr,
      },
      data.platform
    );
  });
  const {samples, weights} = treeToSamples(data.trees[treeIndex]!);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const profile = SampledProfile.FromProfile(
    {
      type: 'sampled',
      name: 'Flamegraph',
      unit: 'count',
      threadID: treeIndex,
      startValue: 0,
      endValue: total,
      samples,
      weights,
    },
    frameIndex,
    {type: 'flamegraph'}
  );
  return new Flamegraph(profile, {inverted: false, sort: 'left heavy'});
}
