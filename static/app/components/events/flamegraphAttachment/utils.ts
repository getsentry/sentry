import {z} from 'zod';

import {t} from 'sentry/locale';
import {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import {Frame} from 'sentry/utils/profiling/frame';
import {SampledProfile} from 'sentry/utils/profiling/profile/sampledProfile';

const frameSchema = z
  .object({
    function: z.string().optional(),
    filename: z.string().optional(),
    instruction_addr: z.string().optional(),
    abs_path: z.string().optional(),
    module: z.string().optional(),
    package: z.string().optional(),
    platform: z.string().optional(),
    symbol: z.string().optional(),
    sym_addr: z.string().optional(),
    in_app: z.boolean().optional(),
    lineno: z.number().int().optional(),
    colno: z.number().int().optional(),
  })
  .refine(frame => Boolean(frame.function || frame.filename || frame.instruction_addr));

const nodeIdSchema = z.number().int().nonnegative();

const nodeSchema = z.object({
  frame_id: z.number().int().nonnegative(),
  sample_count: z.number().int().positive(),
  children: z.array(nodeIdSchema).optional(),
});

const treeSchema = z.object({
  roots: z.array(nodeIdSchema).min(1),
  thread_id: z.string().optional(),
  thread_attributed: z.boolean().optional(),
});

const flamegraphAttachmentSchema = z
  .object({
    version: z.literal('1'),
    platform: z.string(),
    frames: z.array(frameSchema).min(1),
    nodes: z.array(nodeSchema).min(1),
    trees: z.array(treeSchema).min(1),
  })
  .refine(data => {
    if (data.trees.some(tree => tree.roots.some(id => id >= data.nodes.length))) {
      return false;
    }
    for (const node of data.nodes) {
      const children = node.children ?? [];
      if (
        node.frame_id >= data.frames.length ||
        children.some(id => id >= data.nodes.length) ||
        children.reduce((sum, id) => sum + data.nodes[id]!.sample_count, 0) >
          node.sample_count
      ) {
        return false;
      }
    }

    // Indexed child references must not form cycles, or traversal would never finish.
    const visiting = new Set<number>();
    const visited = new Set<number>();
    for (let id = 0; id < data.nodes.length; id++) {
      const pending = [{id, exiting: false}];
      while (pending.length) {
        const current = pending.pop()!;
        if (current.exiting) {
          visiting.delete(current.id);
          visited.add(current.id);
          continue;
        }
        if (visiting.has(current.id)) {
          return false;
        }
        if (visited.has(current.id)) {
          continue;
        }
        visiting.add(current.id);
        pending.push({id: current.id, exiting: true});
        for (const child of data.nodes[current.id]!.children ?? []) {
          pending.push({id: child, exiting: false});
        }
      }
    }
    return true;
  });

export type FlamegraphAttachmentTree = z.infer<typeof treeSchema>;
export type FlamegraphAttachmentData = z.infer<typeof flamegraphAttachmentSchema>;

export function parseFlamegraphAttachment(value: unknown): FlamegraphAttachmentData {
  let payload: unknown = value;
  if (typeof value === 'string') {
    try {
      payload = JSON.parse(value);
    } catch {
      throw new Error(t('The flamegraph attachment is not valid JSON.'));
    }
  }
  const result = flamegraphAttachmentSchema.safeParse(payload);
  if (!result.success) {
    throw new Error(
      result.error.issues.some(issue => issue.path[0] === 'version')
        ? t('This flamegraph attachment version is not supported.')
        : t('The flamegraph attachment has an unsupported format.')
    );
  }
  return result.data;
}

export function treeToSamples(
  data: FlamegraphAttachmentData,
  tree: FlamegraphAttachmentTree
): {
  samples: number[][];
  weights: number[];
} {
  const samples: number[][] = [];
  const weights: number[] = [];
  const pending = tree.roots.map(id => ({id, path: [] as number[]})).reverse();
  while (pending.length) {
    const {id, path} = pending.pop()!;
    const node = data.nodes[id]!;
    const currentPath = [...path, node.frame_id];
    const children = node.children ?? [];
    const selfCount =
      node.sample_count -
      children.reduce((sum, child) => sum + data.nodes[child]!.sample_count, 0);
    if (selfCount > 0) {
      samples.push(currentPath);
      weights.push(selfCount);
    }
    for (let index = children.length - 1; index >= 0; index--) {
      pending.push({id: children[index]!, path: currentPath});
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
  const {samples, weights} = treeToSamples(data, data.trees[treeIndex]!);
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
