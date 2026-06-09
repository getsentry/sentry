import {Checkbox} from '@sentry/scraps/checkbox';

import type {ListItemCheckboxState} from 'sentry/utils/list/useListItemCheckboxState';

export function ListSelectAllCheckbox({
  listItemCheckboxState: {deselectAll, isAllSelected, selectedIds, selectAll},
  data,
}: {
  data: unknown[];
  listItemCheckboxState: ListItemCheckboxState;
}) {
  return (
    <Checkbox
      checked={isAllSelected}
      disabled={data.length === 0}
      onChange={() => {
        if (isAllSelected === true || selectedIds.length === data.length) {
          deselectAll();
        } else {
          selectAll();
        }
      }}
    />
  );
}
