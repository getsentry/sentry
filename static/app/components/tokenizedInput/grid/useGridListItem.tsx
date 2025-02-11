import type {RefObject} from 'react';
import {useMemo} from 'react';
import {useGridListItem as useGridListItemAria} from '@react-aria/gridlist';
import type {ListState} from '@react-stately/list';
import type {Node} from '@react-types/shared';

interface UseGridListItemOptions<T> {
  item: Node<T>;
  ref: RefObject<HTMLDivElement>;
  state: ListState<T>;
}

export function useGridListItem<T>({item, ref, state}: UseGridListItemOptions<T>) {
  const {rowProps, gridCellProps} = useGridListItemAria({node: item}, state, ref);

  return useMemo(() => {
    return {
      rowProps: {
        ...rowProps,
        // Default behavior is for click events to select the item
        onClick: noop,
        onMouseDown: noop,
        onPointerDown: noop,
      },
      gridCellProps,
    };
  }, [rowProps, gridCellProps]);
}

function noop() {}
