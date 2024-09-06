import {useCallback} from 'react';
import type {ListState} from '@react-stately/list';
import type {Node} from '@react-types/shared';

import type {ParseResultToken} from 'sentry/components/searchSyntax/parser';

type Props = {
  item: Node<ParseResultToken>;
  state: ListState<ParseResultToken>;
};

export function useFilterButtonProps({item, state}: Props) {
  const onFocus = useCallback(() => {
    // Ensure that the state is updated correctly
    state.selectionManager.setFocusedKey(item.key);
  }, [item.key, state.selectionManager]);

  return {
    onFocus,
    tabIndex: -1,
  };
}
