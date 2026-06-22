import {createContext, useContext, type ReactNode} from 'react';

const GroupIdContext = createContext<string | null>(null);

interface GroupIdProviderProps {
  children: ReactNode;
  groupId: string;
}

/**
 * Provides the current group ID to descendant components.
 *
 * Unlike `GroupContext`, which requires the fully loaded group, the ID is known from
 * the route params or props before the group request completes. This means it will be
 * available immediately, and can be used by components which only need the ID.
 */
export function GroupIdProvider({children, groupId}: GroupIdProviderProps) {
  return <GroupIdContext value={groupId}>{children}</GroupIdContext>;
}

/**
 * Returns the current group ID from context. Must be used within a `GroupIdProvider`.
 * Prefer this to `useGroupData()` for components which only need the ID.
 */
export function useGroupId(): string {
  const groupId = useContext(GroupIdContext);
  if (!groupId) {
    throw new Error('useGroupId must be used within a GroupIdProvider');
  }
  return groupId;
}
