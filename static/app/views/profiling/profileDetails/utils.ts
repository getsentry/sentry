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
  return collection.reduce((acc, record) => {
    const value = record[key];
    if (value && !acc.includes(value)) {
      acc.push(value);
    }
    return acc;
  }, [] as string[]);
}

type Row = Record<string, string | number | undefined>;
export interface AggregateColumnConfig<T = Record<string, number>> {
  compute: (data: T[]) => number;
  key: string;
}
export function aggregate<T extends Row>(
  data: T[],
  groups: Extract<keyof T, string>[],
  aggregates: AggregateColumnConfig<T>[]
) {
  const groupedData = groupBy(data, groups);

  const rows: Row[] = [];
  for (const groupedKey in groupedData) {
    const row = makeRowFromGroupedKey(groupedKey, groups);
    const groupedValues = groupedData[groupedKey];
    aggregates.forEach(agg => {
      row[agg.key] = agg.compute(groupedValues);
    });
    rows.push(row);
  }
  return rows;
}

function groupBy<T extends Row>(data: T[], groups: Extract<keyof T, string>[]) {
  return data.reduce((acc, row) => {
    const key = getGroupedKey(row, groups);
    if (!acc[key]) {
      acc[key] = [];
    }

    acc[key].push(row);
    return acc;
  }, {});
}

const FIELD_SEPARATOR = String.fromCharCode(31);

function getGroupedKey(row: Record<string, unknown>, groups: string[]) {
  return groups.map(key => row[key]).join(FIELD_SEPARATOR);
}

function makeRowFromGroupedKey(groupedKey: string, groups: string[]) {
  const groupedKeyValues = groupedKey.split(FIELD_SEPARATOR);
  return groups.reduce((acc, key, idx) => {
    acc[key] = groupedKeyValues[idx];
    return acc;
  }, {} as Row);
}
