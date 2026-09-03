import {SESSION_ID} from '@sentry/conventions/attributes';

import {stripArrayMembershipOperator} from 'sentry/components/searchSyntax/utils';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';

import type {SessionDatasetKey} from './datasets';
import {SESSION_DATASETS} from './datasets';

export type KnownKeysByDataset = Record<SessionDatasetKey, ReadonlySet<string>>;

/**
 * Keys every dataset understands. They are not attributes of a telemetry item so
 * they never show up in a dataset's attribute list, but the events endpoint
 * accepts them everywhere.
 */
const UNIVERSAL_KEYS: ReadonlySet<string> = new Set([
  'project',
  'project.id',
  'project.name',
  'environment',
  'release',
  'timestamp',
  'trace',
  SESSION_ID,
]);

const ALL_DATASET_KEYS: SessionDatasetKey[] = SESSION_DATASETS.map(config => config.key);

/** `count(span.duration)` references `span.duration`, not `count`. */
function unwrapAggregate(key: string): string {
  const open = key.indexOf('(');
  if (open === -1 || !key.endsWith(')')) {
    return key;
  }
  return key.slice(open + 1, -1).trim();
}

function normalizeKey(key: string): string {
  // Negated filters are stored under their own `!key` entry.
  const withoutNegation = key.startsWith('!') ? key.slice(1) : key;
  // Array membership carries a `[*]` suffix (eg. `foo[*]`).
  return unwrapAggregate(stripArrayMembershipOperator(withoutNegation));
}

/**
 * Every attribute key a query needs a dataset to know about.
 *
 * `has:span.op` is the interesting case: the key is `has`, which no dataset has
 * as an attribute, while the thing that must exist is the *value*.
 */
export function requiredKeys(query: string): string[] {
  const search = new MutableSearch(query);
  const keys = new Set<string>();

  search.getFilterKeys().forEach(rawKey => {
    const key = normalizeKey(rawKey);
    if (key === 'has') {
      search.getFilterValues(rawKey).forEach(value => {
        const attribute = normalizeKey(value);
        if (attribute) {
          keys.add(attribute);
        }
      });
      return;
    }
    if (key) {
      keys.add(key);
    }
  });

  return Array.from(keys);
}

/**
 * The datasets that can answer `query`.
 *
 * A session is shown when at least one telemetry item matches the whole filter,
 * so a dataset is only worth querying when it knows every key the filter
 * mentions — no item of that type could satisfy a filter over an attribute the
 * dataset has never seen. This also keeps us from sending a dataset a query it
 * would reject outright.
 *
 * An empty result is meaningful: nothing can match, so the page shows no rows.
 */
export function datasetsForQuery(
  query: string,
  knownKeys: KnownKeysByDataset
): SessionDatasetKey[] {
  if (!query.trim()) {
    return ALL_DATASET_KEYS;
  }

  const required = requiredKeys(query);
  if (required.length === 0) {
    // Free text only — every dataset can search it.
    return ALL_DATASET_KEYS;
  }

  return ALL_DATASET_KEYS.filter(datasetKey =>
    required.every(key => UNIVERSAL_KEYS.has(key) || knownKeys[datasetKey].has(key))
  );
}

/** Keys no dataset recognizes, for explaining an empty result. */
export function unrecognizedKeys(query: string, knownKeys: KnownKeysByDataset): string[] {
  if (!query.trim()) {
    return [];
  }

  return requiredKeys(query).filter(
    key =>
      !UNIVERSAL_KEYS.has(key) &&
      ALL_DATASET_KEYS.every(datasetKey => !knownKeys[datasetKey].has(key))
  );
}
