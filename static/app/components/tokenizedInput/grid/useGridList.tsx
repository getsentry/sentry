import type {RefObject} from 'react';
import {useMemo} from 'react';
import type {AriaGridListOptions} from '@react-aria/gridlist';
import {useGridList as useGridListAria} from '@react-aria/gridlist';
import {ListKeyboardDelegate} from '@react-aria/selection';
import type {ListState} from '@react-stately/list';

interface UseGridListProps<T> {
  props: AriaGridListOptions<T>;
  ref: RefObject<HTMLDivElement>;
  state: ListState<T>;
}

export function useGridList<T>({props, ref, state}: UseGridListProps<T>) {
  // The default behavior uses vertical naviation, but we want horizontal navigation
  const delegate = useMemo(() => {
    return new ListKeyboardDelegate({
      collection: state.collection,
      disabledKeys: state.disabledKeys,
      ref,
      orientation: 'horizontal',
      direction: 'ltr',
    });
  }, [ref, state]);

  const {gridProps} = useGridListAria(
    {
      ...props,
      shouldFocusWrap: false,
      keyboardDelegate: delegate,
    },
    state,
    ref
  );

  return useMemo(() => {
    return {
      gridProps: {
        ...gridProps,
        // The default behavior will capture some keys such as Enter and Space, which
        // we want to handle ourselves.
        onKeyDownCapture: noop,
      },
    };
  }, [gridProps]);
}

function noop() {}
