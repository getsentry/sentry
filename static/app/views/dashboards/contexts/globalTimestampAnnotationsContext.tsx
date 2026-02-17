import type {ReactNode} from 'react';
import {createContext, useCallback, useContext, useState} from 'react';

interface TimestampAnnotationEntry {
  timestamp: number;
  color?: string;
  label?: string;
  lineStyle?: 'solid' | 'dashed' | 'dotted';
}

interface GlobalTimestampAnnotationsContextValue {
  addAnnotation: (annotation: TimestampAnnotationEntry) => void;
  annotations: TimestampAnnotationEntry[];
  clearAnnotations: () => void;
  removeAnnotation: (index: number) => void;
}

const GlobalTimestampAnnotationsContext =
  createContext<GlobalTimestampAnnotationsContextValue | null>(null);

interface GlobalTimestampAnnotationsProviderProps {
  children: ReactNode;
}

export function GlobalTimestampAnnotationsProvider({
  children,
}: GlobalTimestampAnnotationsProviderProps) {
  const [annotations, setAnnotations] = useState<TimestampAnnotationEntry[]>([]);

  const addAnnotation = useCallback((annotation: TimestampAnnotationEntry) => {
    setAnnotations(prev => [...prev, annotation]);
  }, []);

  const removeAnnotation = useCallback((index: number) => {
    setAnnotations(prev => prev.filter((_, i) => i !== index));
  }, []);

  const clearAnnotations = useCallback(() => {
    setAnnotations([]);
  }, []);

  return (
    <GlobalTimestampAnnotationsContext.Provider
      value={{annotations, addAnnotation, removeAnnotation, clearAnnotations}}
    >
      {children}
    </GlobalTimestampAnnotationsContext.Provider>
  );
}

/**
 * Read-only hook that returns global timestamp annotations.
 * Returns `[]` when no provider is present, so it's safe to use without a provider.
 */
export function useGlobalTimestampAnnotations(): TimestampAnnotationEntry[] {
  const context = useContext(GlobalTimestampAnnotationsContext);
  return context?.annotations ?? [];
}

/**
 * Full context hook with add/remove/clear. Throws if used outside a provider.
 */
export function useGlobalTimestampAnnotationsContext(): GlobalTimestampAnnotationsContextValue {
  const context = useContext(GlobalTimestampAnnotationsContext);
  if (!context) {
    throw new Error(
      'useGlobalTimestampAnnotationsContext must be used within a GlobalTimestampAnnotationsProvider'
    );
  }
  return context;
}
