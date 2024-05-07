import {type AriaGridListOptions, useGridList} from '@react-aria/gridlist';
import {ListKeyboardDelegate} from '@react-aria/selection';
import type {ListState} from '@react-stately/list';
import type {CollectionChildren} from '@react-types/shared';

import type {ParseResultToken} from 'sentry/components/searchSyntax/parser';

interface UseQueryBuilderGridProps extends AriaGridListOptions<ParseResultToken> {
  children: CollectionChildren<ParseResultToken>;
}

/**
 * Modified version React Aria's useGridList to support the search component.
 *
 * See https://react-spectrum.adobe.com/react-aria/useGridList.html
 */
export function useQueryBuilderGrid(
  props: UseQueryBuilderGridProps,
  state: ListState<ParseResultToken>,
  ref: React.RefObject<HTMLDivElement>
) {
  // The default behavior uses vertical naviation, but we want horizontal navigation
  const delegate = new ListKeyboardDelegate({
    collection: state.collection,
    disabledKeys: state.disabledKeys,
    ref,
    orientation: 'horizontal',
    direction: 'ltr',
  });

  const {gridProps} = useGridList(
    {
      ...props,
      shouldFocusWrap: false,
      keyboardDelegate: delegate,
    },
    state,
    ref
  );

  return {
    gridProps: {
      ...gridProps,
      // If we click inside the grid but not on any of the items, focus the last one
      onClick: () => {
        state.selectionManager.setFocused(true);
        state.selectionManager.setFocusedKey(state.collection.getLastKey());
      },
      // The default behavior will capture some keys such as Enter and Space, which
      // we want to handle ourselves.
      onKeyDownCapture: () => {},
    },
  };
}
