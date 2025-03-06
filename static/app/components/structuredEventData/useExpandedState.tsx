import type {ReactNode} from 'react';
import {createContext, useCallback, useContext, useMemo, useRef} from 'react';

import {uniq} from 'sentry/utils/array/uniq';

type State = 'expanded' | 'collapsed';

const context = createContext<{
  collapse: (path: string) => void;
  expand: (path: string) => void;
  expandedPaths: string[];
}>({
  collapse: () => {},
  expand: () => {},
  expandedPaths: [],
});

interface Props {
  children: ReactNode;
  initialExpandedPaths: () => string[];
  onToggleExpand?: (expandedPaths: string[], path: string, state: State) => void;
}

export function ExpandedStateContextProvider({
  children,
  initialExpandedPaths,
  onToggleExpand,
}: Props) {
  const expandedRef = useRef<string[]>(initialExpandedPaths());

  const expand = useCallback(
    (path: any) => {
      expandedRef.current = uniq(expandedRef.current.concat(path));
      onToggleExpand?.(expandedRef.current, path, 'expanded');
    },
    [onToggleExpand]
  );

  const collapse = useCallback(
    (path: any) => {
      expandedRef.current = expandedRef.current.filter(prevPath => path !== prevPath);
      onToggleExpand?.(expandedRef.current, path, 'collapsed');
    },
    [onToggleExpand]
  );

  const value = useMemo(
    () => ({collapse, expand, expandedPaths: expandedRef.current}),
    [collapse, expand]
  );

  return <context.Provider value={value}>{children}</context.Provider>;
}

export default function useExpandedState({path}: {path: string}) {
  const {collapse, expand, expandedPaths} = useContext(context);
  const isExpanded = expandedPaths.includes(path);
  return useMemo(
    () => ({
      collapse: () => collapse(path),
      expand: () => expand(path),
      isExpanded,
    }),
    [collapse, expand, isExpanded, path]
  );
}
