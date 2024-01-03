import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {uuid4} from '@sentry/utils';
import isEmpty from 'lodash/isEmpty';
import isEqual from 'lodash/isEqual';

import {useClearQuery, useInstantRef, useUpdateQuery} from 'sentry/utils/metrics';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import usePrevious from 'sentry/utils/usePrevious';
import useRouter from 'sentry/utils/useRouter';

type Scratchpad = {
  id: string;
  name: string;
  query: Record<string, unknown>;
};

type ScratchpadState = {
  default: string | null;
  scratchpads: Record<string, Scratchpad>;
};

function makeLocalStorageKey(orgSlug: string) {
  return `ddm-scratchpads:${orgSlug}`;
}

const EMPTY_QUERY = {};

const mapProjectQueryParam = (project: any) => {
  if (typeof project === 'string') {
    return [Number(project)];
  }
  if (Array.isArray(project)) {
    return project.map(Number);
  }
  return [];
};

function useScratchpadUrlSync() {
  const {slug} = useOrganization();
  const router = useRouter();
  const updateQuery = useUpdateQuery();
  const clearQuery = useClearQuery();
  const {projects} = usePageFilters().selection;

  const [state, setState] = useLocalStorageState<ScratchpadState>(
    makeLocalStorageKey(slug),
    {
      default: null,
      scratchpads: {},
    }
  );
  const stateRef = useInstantRef(state);
  const routerQuery = router.location.query ?? EMPTY_QUERY;
  const routerQueryRef = useInstantRef(routerQuery);

  const [selected, setSelected] = useState<string | null | undefined>(() => {
    if (
      (state.default && !routerQuery.widgets) ||
      (state.default && isEqual(state.scratchpads[state.default].query, routerQuery))
    ) {
      return state.default;
    }
    return undefined;
  });

  const savedProjects = selected && state.scratchpads[selected].query.project;
  // The scratchpad is "loading" while the project selection state is different from the saved state
  const isLoading = !!selected && !isEqual(mapProjectQueryParam(savedProjects), projects);

  const toggleSelected = useCallback(
    (id: string | null) => {
      if (id === selected) {
        setSelected(null);
      } else {
        setSelected(id);
      }
    },
    [setSelected, selected]
  );

  const setDefault = useCallback(
    (id: string | null) => {
      setState({...state, default: id});
    },
    [state, setState]
  );

  const add = useCallback(
    (name: string) => {
      const currentState = stateRef.current;
      const id = uuid4();
      const newScratchpads = {
        ...currentState.scratchpads,
        [id]: {
          name,
          id,
          query: {environment: null, statsPeriod: null, ...routerQueryRef.current},
        },
      };
      setState({...currentState, scratchpads: newScratchpads});
      toggleSelected(id);
    },
    [stateRef, routerQueryRef, setState, toggleSelected]
  );

  const update = useCallback(
    (id: string, query: Scratchpad['query']) => {
      const currentState = stateRef.current;
      const oldScratchpad = currentState.scratchpads[id];
      const newQuery = {
        ...query,
      };
      const newScratchpads = {
        ...currentState.scratchpads,
        [id]: {...oldScratchpad, query: newQuery},
      };
      setState({...currentState, scratchpads: newScratchpads});
    },
    [setState, stateRef]
  );

  const remove = useCallback(
    (id: string) => {
      const currentState = stateRef.current;
      const newScratchpads = {...currentState.scratchpads};
      delete newScratchpads[id];
      if (currentState.default === id) {
        setState({...currentState, default: null, scratchpads: newScratchpads});
      } else {
        setState({...currentState, scratchpads: newScratchpads});
      }
      if (selected === id) {
        toggleSelected(null);
      }
    },
    [stateRef, selected, setState, toggleSelected]
  );

  // Changes the query when a scratchpad is selected, clears it when none is selected
  useEffect(() => {
    const selectedQuery = selected && stateRef.current.scratchpads[selected].query;
    if (selectedQuery && !isEqual(selectedQuery, routerQueryRef.current)) {
      const queryCopy: Record<string, any> = {
        project: undefined, // make sure that project will be removed if not present in the stored query
        ...selectedQuery,
      };
      // If the selected scratchpad has a start and end date, remove the statsPeriod
      if (selectedQuery.start && selectedQuery.end) {
        delete queryCopy.statsPeriod;
      }
      updateQuery(queryCopy);
    } else if (selectedQuery === null) {
      clearQuery();
    }
  }, [clearQuery, updateQuery, selected, routerQueryRef, stateRef]);

  const previousSelected = usePrevious(selected);
  // Saves all URL changes to the selected scratchpad to local storage
  useEffect(() => {
    const selectedQuery = selected && stateRef.current.scratchpads[selected].query;
    // normal update path
    if (selected && !isEmpty(routerQuery) && !isLoading) {
      update(selected, routerQuery);
      // project selection changes should ignore loading state
    } else if (
      selectedQuery &&
      isLoading &&
      selected === previousSelected &&
      routerQuery.project !== selectedQuery.project
    ) {
      update(selected, routerQuery);
    }
  }, [routerQuery, projects, selected, update, isLoading, stateRef, previousSelected]);

  return useMemo(
    () => ({
      all: state.scratchpads,
      default: state.default,
      selected,
      isLoading,
      add,
      update,
      remove,
      toggleSelected,
      setDefault,
    }),
    [state, selected, isLoading, add, update, remove, toggleSelected, setDefault]
  );
}

const Context = createContext<ReturnType<typeof useScratchpadUrlSync>>({
  all: {},
  default: null,
  selected: null,
  isLoading: false,
  add: () => {},
  update: () => {},
  remove: () => {},
  toggleSelected: () => {},
  setDefault: () => {},
});

export const useScratchpads = () => {
  return useContext(Context);
};

export function ScratchpadsProvider({children}: {children: React.ReactNode}) {
  const contextValue = useScratchpadUrlSync();
  return <Context.Provider value={contextValue}>{children}</Context.Provider>;
}
