import {createContext, useContext, useMemo} from 'react';

type Props = {
  children: React.ReactNode;
  eventId?: string;
  groupId?: string;
};

type BreadcrumbCustomizationContextType = Omit<Props, 'children'>;

const ReplayGroupContext = createContext<BreadcrumbCustomizationContextType>({});

/**
 * Used when rendering a replay within the context of a group.
 * Provides event and group IDs which customize the breadcrumb items
 * to highlight the current event and group.
 */
export function ReplayGroupContextProvider({children, groupId, eventId}: Props) {
  const value = useMemo(() => ({groupId, eventId}), [groupId, eventId]);

  return (
    <ReplayGroupContext.Provider value={value}>{children}</ReplayGroupContext.Provider>
  );
}

export const useReplayGroupContext = () => useContext(ReplayGroupContext);
