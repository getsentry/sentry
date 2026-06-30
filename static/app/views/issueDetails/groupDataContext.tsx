import {createContext, useContext, useMemo, type ReactNode} from 'react';

import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {GroupIdProvider} from 'sentry/views/issueDetails/groupIdContext';

interface GroupDataContextValue {
  group: Group;
  project: Project;
}

const GroupDataContext = createContext<GroupDataContextValue | null>(null);

interface GroupDataContextProviderProps {
  children: ReactNode;
  group: Group;
  project: Project;
}

/**
 * Provides the current group and project data to descendant components.
 */
export function GroupDataContextProvider({
  children,
  group,
  project,
}: GroupDataContextProviderProps) {
  const value = useMemo(() => ({group, project}), [group, project]);
  return (
    <GroupDataContext value={value}>
      <GroupIdProvider groupId={group.id}>{children}</GroupIdProvider>
    </GroupDataContext>
  );
}

interface Options<AllowNull extends boolean = boolean> {
  allowNull?: AllowNull;
}

export function useGroupData(opts?: Options<false>): GroupDataContextValue;
export function useGroupData(opts: Options<true>): GroupDataContextValue | null;

/**
 * Returns the current group and project data from context. Must be used within a `GroupDataContextProvider`.
 * Prefer `useGroupId()` for components which only need the ID.
 */
export function useGroupData({
  allowNull = false,
}: Options = {}): GroupDataContextValue | null {
  const context = useContext(GroupDataContext);

  if (allowNull) {
    return context;
  }

  if (!context) {
    throw new Error('useGroupData must be used within a GroupDataContextProvider');
  }
  return context;
}
