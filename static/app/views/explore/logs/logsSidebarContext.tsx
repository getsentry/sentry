import {createContext, useContext} from 'react';

type LogsSidebarContextValue = (open: boolean) => void;

const LogsSidebarContext = createContext<LogsSidebarContextValue | undefined>(undefined);

interface LogsSidebarProviderProps {
  children: React.ReactNode;
  value: (open: boolean) => void;
}

export function LogsSidebarProvider({children, value}: LogsSidebarProviderProps) {
  return (
    <LogsSidebarContext.Provider value={value}>{children}</LogsSidebarContext.Provider>
  );
}

export function useLogsSidebar() {
  return useContext(LogsSidebarContext);
}
