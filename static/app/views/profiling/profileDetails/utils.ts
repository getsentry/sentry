import groupBy from 'lodash/groupBy';

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
  }, [] as any[]);
}

export type Row<K extends string = string> = Record<
  Extract<K, string>,
  string | number | undefined
>;
export interface AggregateColumnConfig<K extends string> {
  compute: (data: Row<K>[]) => number;
  key: string;
}
export function aggregate<T extends string>(
  data: Partial<Row<T>>[],
  groups: Extract<T, string>[],
  aggregates: AggregateColumnConfig<T>[]
): Row<T>[] {
  // group by a key composed by unique values
  // ex: { a: "foo", b: "bar" } => { "foo bar": [...] }
  const groupedData = groupBy(data, row => getGroupedKey(row, groups));

  const rows: Row[] = [];
  for (const groupedKey in groupedData) {
    // unwrap the grouped key into a base value
    // ex: { "foo bar": [...] } => {a: "foo", b: "bar"}
    const row = makeRowFromGroupedKey(groupedKey, groups);
    const groupedValues = groupedData[groupedKey] as Row<T>[];

    aggregates.forEach(agg => {
      // do the actual aggregation with the grouped values
      // ex: { a: "foo", b: "bar", sum: 123 }
      row[agg.key] = agg.compute(groupedValues);
    });
    rows.push(row);
  }
  return rows;
}

// we'll use the "unit separator" character to delimit grouped values
// https://en.wikipedia.org/wiki/Delimiter#ASCII_delimited_text
const FIELD_SEPARATOR = String.fromCharCode(31);

// getGroupedKey will derive a key from an objects values and delimit them using
// the unit separator
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
