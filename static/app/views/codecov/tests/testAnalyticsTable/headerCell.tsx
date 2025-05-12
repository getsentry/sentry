import type {Location} from 'history';

import type {GridColumnHeader} from 'sentry/components/gridEditable';
import SortLink from 'sentry/components/gridEditable/sortLink';
import type {Sort} from 'sentry/utils/discover/fields';
import {
  RIGHT_ALIGNED_FIELDS,
  SORTABLE_FIELDS,
} from 'sentry/views/codecov/tests/testAnalyticsTable/testAnalyticsTable';

const DEFAULT_SORT_PARAMETER_NAME = 'sort';

type TableHeaderParams = {
  column: GridColumnHeader<string>;
  location?: Location;
  sort?: Sort;
};

export const renderHeadCell = ({column, location, sort}: TableHeaderParams) => {
  const {key, name} = column;
  const alignment = RIGHT_ALIGNED_FIELDS.has(key) ? 'right' : 'left';

  let newSortDirection: Sort['kind'] = 'desc';
  if (sort?.field === column.key) {
    if (sort.kind === 'desc') {
      newSortDirection = 'asc';
    }
  }
  const newSort = `${newSortDirection === 'desc' ? '-' : ''}${key}`;

  return (
    <SortLink
      align={alignment}
      canSort={Boolean(location && sort && key in SORTABLE_FIELDS)}
      direction={sort?.field === column.key ? sort.kind : undefined}
      title={name}
      generateSortLink={() => {
        return {
          ...location,
          query: {
            ...location?.query,
            [DEFAULT_SORT_PARAMETER_NAME]: newSort,
          },
        };
      }}
    />
  );
};
