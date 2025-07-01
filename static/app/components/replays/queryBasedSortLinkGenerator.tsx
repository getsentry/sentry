import type {Location, LocationDescriptorObject} from 'history';

import type {GridColumnOrder} from 'sentry/components/tables/gridEditable';
import type {Sort} from 'sentry/utils/discover/fields';

export default function queryBasedSortLinkGenerator<Key extends string | number>(
  location: Location,
  column: GridColumnOrder<Key>,
  currentSort: Sort
): () => LocationDescriptorObject {
  const direction =
    currentSort.field === column.key
      ? currentSort.kind === 'desc'
        ? 'asc'
        : 'desc'
      : 'desc';

  return () => ({
    ...location,
    query: {
      ...location.query,
      sort: `${direction === 'desc' ? '-' : ''}${column.key}`,
    },
  });
}
