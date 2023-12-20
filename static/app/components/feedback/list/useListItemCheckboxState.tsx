import {useCallback, useEffect, useMemo, useState} from 'react';

import useFeedbackQueryKeys from 'sentry/components/feedback/useFeedbackQueryKeys';

interface Props {
  hits: number;
  knownIds: string[];
}

/**
 * We can either have a list of ids, or have all selected.
 * When all is selected we may, or may not, have all ids loaded into the browser
 */
type State = {ids: Set<string>} | {all: true};

interface Return {
  /**
   * How many ids are selected
   */
  countSelected: number;
  /**
   * Ensure nothing is selected, no matter the state prior
   */
  deselectAll: () => void;
  /**
   * True if all are selected
   *
   * When some are selected returns 'indeterminate'
   */
  isAllSelected: 'indeterminate' | boolean;
  /**
   * True if one or more are selected
   */
  isAnySelected: boolean;
  /**
   * True if this specific id is selected
   */
  isSelected: (id: string) => 'all-selected' | boolean;
  /**
   * Record that all are selected, wether or not all feedback ids are loaded or not
   */
  selectAll: () => void;
  /**
   * The list of specifically selected ids, or 'all' to save space
   */
  selectedIds: 'all' | string[];
  /**
   * Toggle if a feedback is selected or not
   * It's not possible to toggle when all are selected, but not all are loaded
   */
  toggleSelected: (id: string) => void;
}

export default function useListItemCheckboxState({hits, knownIds}: Props): Return {
  const {getListQueryKey} = useFeedbackQueryKeys();
  const [state, setState] = useState<State>({ids: new Set()});

  const listQueryKey = getListQueryKey();
  useEffect(() => {
    // Reset the state when the list changes
    setState({ids: new Set()});
  }, [listQueryKey]);

  const selectAll = useCallback(() => {
    // Record that the virtual "all" list is enabled.
    setState({all: true});
  }, []);

  const deselectAll = useCallback(() => {
    setState({ids: new Set()});
  }, []);

  const toggleSelected = useCallback(
    (id: string) => {
      setState(prev => {
        if ('all' in prev && hits !== knownIds.length) {
          // Unable to toggle individual items when "all" are selected, but not
          // all items are loaded. We can't omit one item from this virtual list.
        }

        // If all is selected, then we're toggling this one off
        if ('all' in prev) {
          const ids = new Set(knownIds);
          ids.delete(id);
          return {ids};
        }

        // We have a list of ids, so we enable/disable as needed
        const ids = prev.ids;
        if (ids.has(id)) {
          ids.delete(id);
        } else {
          ids.add(id);
        }
        return {ids};
      });
    },
    [hits, knownIds]
  );

  const isSelected = useCallback(
    (id: string) => {
      // If we are using the virtual "all", and we don't have everything loaded,
      // return the sentinal value 'all-selected'
      if ('all' in state && hits !== knownIds.length) {
        return 'all-selected';
      }
      // If "all" is selected
      if ('all' in state) {
        return true;
      }

      // Otherwise true/value is fine
      return state.ids.has(id);
    },
    [state, hits, knownIds]
  );

  const isAllSelected = useMemo(() => {
    if ('all' in state) {
      return true;
    }

    if (state.ids.size === 0) {
      return false;
    }
    if (state.ids.size === hits) {
      return true;
    }
    return 'indeterminate';
  }, [state, hits]);

  const isAnySelected = useMemo(() => 'all' in state || state.ids.size > 0, [state]);

  const selectedIds = useMemo(() => {
    return 'all' in state ? 'all' : Array.from(state.ids);
  }, [state]);

  return {
    countSelected: 'all' in state ? hits : selectedIds.length,
    deselectAll,
    isAllSelected,
    isAnySelected,
    isSelected,
    selectAll,
    selectedIds,
    toggleSelected,
  };
}
