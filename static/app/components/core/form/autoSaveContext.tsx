import {createContext, useContext} from 'react';

/**
 * Context for auto-save mutation state
 * Consumed by field components to automatically apply mutation state
 */
interface AutoSaveContextValue {
  resetOnErrorRef: React.RefObject<boolean>;
  status: 'pending' | 'error' | 'idle' | 'success';
}

const AutoSaveContext = createContext<AutoSaveContextValue | null>(null);

/**
 * Hook to access auto-save context
 * Returns null if not within AutoSaveField
 */
export function useAutoSaveContext() {
  return useContext(AutoSaveContext);
}

/**
 * Provider for auto-save context
 * Wraps fields to provide mutation state
 */
export function AutoSaveContextProvider({
  value,
  children,
}: {
  children: React.ReactNode;
  value: AutoSaveContextValue;
}) {
  return <AutoSaveContext value={value}>{children}</AutoSaveContext>;
}
