import type {Location} from 'history';

import type {GridColumnSort} from 'sentry/components/tables/gridEditable';
import {
  type EventView,
  isFieldSortable,
  type MetaType,
} from 'sentry/utils/discover/eventView';
import type {Field} from 'sentry/utils/discover/fields';

type QueryStringObject = ReturnType<EventView['generateQueryStringObject']>;

interface Options extends Pick<GridColumnSort, 'align' | 'onSort'> {
  eventView: EventView;
  field: Field;
  location: Location;
  meta: MetaType | undefined;
  /**
   * Overrides `isFieldSortable`, for tables that exclude columns the meta says
   * are sortable.
   */
  canSort?: boolean;
  /**
   * Builds the target query from the sorted `EventView`. Defaults to carrying
   * only the new `sort` onto the current query.
   */
  makeQuery?: (queryStringObject: QueryStringObject) => Location['query'];
}

export function getEventViewColumnSort({
  align,
  canSort,
  eventView,
  field,
  location,
  makeQuery,
  meta,
  onSort,
}: Options): GridColumnSort {
  const sortable = (canSort ?? true) && isFieldSortable(field, meta);

  if (!sortable || !meta) {
    return {align};
  }

  const queryStringObject = eventView
    .sortOnField(field, meta)
    .generateQueryStringObject();

  return {
    align,
    direction: eventView.sortForField(field, meta)?.kind,
    onSort,
    to: {
      ...location,
      query: makeQuery?.(queryStringObject) ?? {
        ...location.query,
        sort: queryStringObject.sort,
      },
    },
  };
}
