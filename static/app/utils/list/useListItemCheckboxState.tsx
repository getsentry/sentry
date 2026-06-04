import type {Dispatch, RefObject, SetStateAction} from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type {QueryKeyEndpointOptions} from 'sentry/utils/api/apiQueryKey';
import {toArray} from 'sentry/utils/array/toArray';

export type ListCheckboxQueryKeyRef = RefObject<undefined | QueryKeyEndpointOptions>;

interface PublicProps {
  /**
   * The cache-key that identifies the query & results.
   *
   * When the key changes, the selection will be reset. Therefore be
   * mindful of query params like `cursor` creating a new query key.
   *
   * This is not the same as ApiQueryKey. But you could use:
   * `safeParseQueryKey(apiQueryKey)?.options`.
   */
  endpointOptions: undefined | QueryKeyEndpointOptions;

  /**
   * The total number of items the query could return
   */
  hits: number;

  /**
   * The number of items that are currently loaded into the browser
   */
  knownIds: string[];
}

interface InternalProps {
  endpointOptionsRef: ListCheckboxQueryKeyRef;
  setState: Dispatch<SetStateAction<State>>;
  state: State;
}
type MergedProps = Omit<PublicProps, 'endpointOptions'> & InternalProps;

/**
 * We can either have a list of ids, or have all selected.
 * When all is selected we may, or may not, have all ids loaded into the browser
 */
type State = {ids: Set<string>} | {all: true};

export interface ListItemCheckboxState {
  /**
   * How many ids are selected
   */
  countSelected: number;

  /**
   * Ensure nothing is selected, no matter the state prior
   */
  deselectAll: () => void;

  /**
   * Stable ref to the query key that fetches the list.
   *
   * Read `.current` to access the value.
   */
  endpointOptionsRef: ListCheckboxQueryKeyRef;

  /**
   * The total number of items the query could return
   */
  hits: number;

  /**
   * True if all are selected
   *
   * When some are selected returns 'indeterminate'
   *
   * Useful at the top of a list of items: <Checkbox checked={isAllSelected}/>
   */
  isAllSelected: 'indeterminate' | boolean;

  /**
   * True if one or more are selected
   *
   * Useful to show bulk-actions at the top of a list whenever anything is selected
   */
  isAnySelected: boolean;

  /**
   * True if this specific id is selected
   *
   * Useful for individual list items: <Checkbox checked={isSelected(id) !== false}/>
   */
  isSelected: (id: string) => 'all-selected' | boolean;

  /**
   * The number of items that are currently loaded into the browser
   */
  knownIds: string[];

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
  toggleSelected: (id: string | string[]) => void;
}

const defaultQueryKeyRef: ListCheckboxQueryKeyRef = {current: undefined};

const ListItemCheckboxContext = createContext<MergedProps>({
  hits: 0,
  knownIds: [],
  endpointOptionsRef: defaultQueryKeyRef,
  setState: () => {},
  state: {ids: new Set()},
});

export function ListItemCheckboxProvider({
  children,
  hits,
  knownIds,
  endpointOptions,
}: {
  children: React.ReactNode;
} & PublicProps) {
  const [state, setState] = useState<State>({ids: new Set()});
  const endpointOptionsRef = useRef(endpointOptions);

  const serializedEndpointOptions = JSON.stringify(endpointOptions);
  useEffect(() => {
    endpointOptionsRef.current = endpointOptions;
    setState({ids: new Set()});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serializedEndpointOptions]);

  return (
    <ListItemCheckboxContext.Provider
      value={{state, setState, hits, knownIds, endpointOptionsRef}}
    >
      {children}
    </ListItemCheckboxContext.Provider>
  );
}

export function useListItemCheckboxContext(): ListItemCheckboxState {
  const {state, setState, hits, knownIds, endpointOptionsRef} = useContext(
    ListItemCheckboxContext
  );

  const selectAll = useCallback(() => {
    // Record that the virtual "all" list is enabled.
    setState({all: true});
  }, [setState]);

  const deselectAll = useCallback(() => {
    setState({ids: new Set()});
  }, [setState]);

  const toggleSelected = useCallback(
    (id: string | string[]) => {
      setState(prev => {
        if ('all' in prev && hits !== knownIds.length) {
          // Unable to toggle individual items when "all" are selected, but not
          // all items are loaded. We can't omit one item from this virtual list.
          return prev;
        }

        const ids = toArray(id);

        // If all is selected, then we're toggling these off
        if ('all' in prev) {
          const cloneKnownIds = new Set(knownIds);
          ids.forEach(i => cloneKnownIds.delete(i));
          return {ids: cloneKnownIds};
        }

        // We have a list of ids, so we enable/disable as needed
        const clonePrevIds = new Set(prev.ids);
        ids.forEach(i => {
          if (clonePrevIds.has(i)) {
            clonePrevIds.delete(i);
          } else {
            clonePrevIds.add(i);
          }
        });
        return {ids: clonePrevIds};
      });
    },
    [hits, knownIds, setState]
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
    hits,
    isAllSelected,
    isAnySelected,
    isSelected,
    knownIds,
    endpointOptionsRef,
    selectAll,
    selectedIds,
    toggleSelected,
  };
}
