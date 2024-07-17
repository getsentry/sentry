import type {ReactNode} from 'react';
import {createContext, useCallback, useContext, useMemo, useState} from 'react';

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
  initialExpandedPaths: string[] | (() => string[]);
  onToggleExpand?: (path: string, expandedPaths: string[], state: State) => void;
}

export function ExpandedStateContextProvider({
  children,
  initialExpandedPaths,
  onToggleExpand,
}: Props) {
  const [expandedPaths, setState] = useState<string[]>(initialExpandedPaths);

  const expand = useCallback(
    path => {
      const newState = uniq(expandedPaths.concat(path));
      setState(newState);
      onToggleExpand?.(path, newState, 'expanded');
    },
    [expandedPaths, onToggleExpand]
  );

  const collapse = useCallback(
    path => {
      const newState = expandedPaths.filter(prevPath => path !== prevPath);
      setState(newState);
      onToggleExpand?.(path, newState, 'collapsed');
    },
    [expandedPaths, onToggleExpand]
  );

  const value = useMemo(
    () => ({collapse, expand, expandedPaths}),
    [collapse, expand, expandedPaths]
  );

  return <context.Provider value={value}>{children}</context.Provider>;
}

export default function useExpandedState() {
  return useContext(context);
}
