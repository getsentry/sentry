import {useListItemCheckboxContext} from 'sentry/utils/list/useListItemCheckboxState';

interface Props {
  children: React.ReactNode;

  /**
   * The state of the list item selection
   *
   * - none: No items are selected
   * - indeterminate-or-all: One or more items are selected
   * - all: All items are selected
   * - indeterminate: Some, but not all, items are selected
   */
  selected: 'none' | 'indeterminate-or-all' | 'all' | 'indeterminate';
}

export function ListItemSelectedState({children, selected}: Props) {
  const {isAllSelected} = useListItemCheckboxContext();
  if (selected === 'none' && isAllSelected === false) {
    return children;
  }

  if (
    selected === 'indeterminate-or-all' &&
    (isAllSelected === true || isAllSelected === 'indeterminate')
  ) {
    return children;
  }

  if (selected === 'all' && isAllSelected === true) {
    return children;
  }

  if (selected === 'indeterminate' && isAllSelected === 'indeterminate') {
    return children;
  }
  return null;
}
