import type {ReactText} from 'react';
import type {Location, LocationDescriptorObject} from 'history';

import type {GridColumnOrder} from 'sentry/components/gridEditable';
import {Sort} from 'sentry/utils/discover/fields';

export default function queryBasedSortLinkGenerator<Key extends ReactText>(
  location: Location,
  column: GridColumnOrder<Key>,
  currentSort: Sort
): () => LocationDescriptorObject {
  const direction =
    currentSort.field !== column.key
      ? 'desc'
      : currentSort.kind === 'desc'
      ? 'asc'
      : 'desc';

  return () => ({
    ...location,
    query: {
      ...location.query,
      sort: `${direction === 'desc' ? '-' : ''}${column.key}`,
    },
  });
}
