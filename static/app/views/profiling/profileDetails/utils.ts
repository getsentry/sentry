import {CallTreeNode} from 'sentry/utils/profiling/callTreeNode';
import {Profile} from 'sentry/utils/profiling/profile/profile';

export function collectProfileFrames(profile: Profile) {
  const nodes: CallTreeNode[] = [];

  profile.forEach(
    node => {
      if (node.selfWeight > 0) {
        nodes.push(node);
      }
    },
    () => {}
  );

  return nodes
    .sort((a, b) => b.selfWeight - a.selfWeight)
    .map(node => ({
      symbol: node.frame.name,
      file: node.frame.file,
      image: node.frame.image,
      thread: profile.threadId,
      type: node.frame.is_application ? 'application' : 'system',
      'self weight': node.selfWeight,
      'total weight': node.totalWeight,
    }));
}

export function pluckUniqueValues<T extends Record<string, any>>(
  collection: T[],
  key: keyof T
) {
  return collection.reduce((acc, val) => {
    if (!acc.includes(val[key])) {
      acc.push(val[key]);
    }
    return acc;
  }, [] as string[]);
}
