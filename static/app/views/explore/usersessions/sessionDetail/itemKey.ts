import type {SessionDatasetKey} from 'sentry/views/explore/usersessions/datasets';

import type {Row} from './rowConfig';

/**
 * How a timeline item is addressed: in the URL, by the rail's selection, and by
 * the scrubber's hit testing.
 *
 * Every kind asks for an `id` (a trace's segment span id, a log id, a metric id,
 * an error's event id), so one shape covers all four. The kind prefix is what
 * keeps two of them from colliding on the same id.
 *
 * Lives on its own rather than beside the types it keys, because the hook that
 * builds the index and the two components that read it would otherwise import
 * each other.
 */
export function itemKey(event: {key: SessionDatasetKey; row: Row}): string | undefined {
  const id = event.row.id;
  if (typeof id !== 'string' || !id) {
    return undefined;
  }
  return `${event.key}:${id}`;
}
