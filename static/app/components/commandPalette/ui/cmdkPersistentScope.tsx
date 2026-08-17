import {createContext, useContext} from 'react';

export type CMDKPersistentAnchor = {
  key: string;
  label: string;
  parentKey: string | null;
  prompt?: string;
};

const CMDKEnclosingActionContext = createContext<CMDKPersistentAnchor | null>(null);
const CMDKPersistentScopeContext = createContext<CMDKPersistentAnchor | null>(null);

/**
 * Keeps callback actions in this subtree inside the command palette. After a
 * callback runs, navigation returns to the group that contains this scope.
 */
export function CMDKPersistentScope({children}: {children: React.ReactNode}) {
  const anchor = useContext(CMDKEnclosingActionContext);

  return (
    <CMDKPersistentScopeContext.Provider value={anchor}>
      {children}
    </CMDKPersistentScopeContext.Provider>
  );
}

export function useCMDKPersistentScope(): CMDKPersistentAnchor | null {
  return useContext(CMDKPersistentScopeContext);
}

export const CMDKEnclosingActionProvider = CMDKEnclosingActionContext.Provider;
