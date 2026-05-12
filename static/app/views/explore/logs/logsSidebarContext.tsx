import {createContext, useContext, useMemo} from 'react';

interface LogsSidebarContextValue {
  setSidebarOpen: (open: boolean) => void;
  sidebarOpen: boolean;
}

const LogsSidebarContext = createContext<LogsSidebarContextValue | null>(null);

interface LogsSidebarProviderProps {
  children: React.ReactNode;
  setSidebarOpen: (open: boolean) => void;
  sidebarOpen: boolean;
}

export function LogsSidebarProvider({
  children,
  sidebarOpen,
  setSidebarOpen,
}: LogsSidebarProviderProps) {
  const value = useMemo(
    () => ({sidebarOpen, setSidebarOpen}),
    [sidebarOpen, setSidebarOpen]
  );
  return (
    <LogsSidebarContext.Provider value={value}>{children}</LogsSidebarContext.Provider>
  );
}

/**
 * Returns the logs sidebar context, or null when there is no surrounding
 * `LogsSidebarProvider` (e.g. embedded usages outside the logs tab).
 */
export function useLogsSidebar() {
  return useContext(LogsSidebarContext);
}
