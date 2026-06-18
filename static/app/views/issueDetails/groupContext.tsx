import {createContext, useContext, type ReactNode} from 'react';

import type {Group} from 'sentry/types/group';

const GroupContext = createContext<Group | null>(null);

interface GroupContextProviderProps {
  children: ReactNode;
  group: Group;
}

/**
 * Wraps issue details or the preview drawer so that descendant components can access
 * the current group via `useGroupContext()`.
 */
export function GroupContextProvider({children, group}: GroupContextProviderProps) {
  return <GroupContext value={group}>{children}</GroupContext>;
}

export function useGroupContext(): Group {
  const group = useContext(GroupContext);
  if (!group) {
    throw new Error('useGroupContext must be used within a GroupContextProvider');
  }
  return group;
}
