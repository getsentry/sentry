import {createContext, useContext, useMemo, useState, type ReactNode} from 'react';

type DebugMetaSearchContextValue = {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
};

const DebugMetaSearchContext = createContext<DebugMetaSearchContextValue | null>(null);

type DebugMetaSearchProviderProps = {
  children: ReactNode;
};

export function DebugMetaSearchProvider({children}: DebugMetaSearchProviderProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const value = useMemo(() => ({searchTerm, setSearchTerm}), [searchTerm, setSearchTerm]);

  return <DebugMetaSearchContext value={value}>{children}</DebugMetaSearchContext>;
}

export function useDebugMetaSearch() {
  const context = useContext(DebugMetaSearchContext);

  if (!context) {
    throw new Error('useDebugMetaSearch must be used within DebugMetaSearchProvider');
  }

  return context;
}

export function useOptionalDebugMetaSearch() {
  return useContext(DebugMetaSearchContext);
}
