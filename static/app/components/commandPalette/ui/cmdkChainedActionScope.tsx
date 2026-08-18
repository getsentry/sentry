import {createContext, useContext} from 'react';

export type CMDKChainedActionAnchor = {
  key: string;
  label: string;
  parentKey: string | null;
  prompt?: string;
};

const CMDKEnclosingActionContext = createContext<CMDKChainedActionAnchor | null>(null);
const CMDKChainedActionScopeContext = createContext<CMDKChainedActionAnchor | null>(null);

/**
 * Keeps callback actions in this subtree inside the command palette. After a
 * callback runs, navigation returns to the group that contains this scope.
 */
export function CMDKChainedActionScope({children}: {children: React.ReactNode}) {
  const anchor = useContext(CMDKEnclosingActionContext);

  return (
    <CMDKChainedActionScopeContext.Provider value={anchor}>
      {children}
    </CMDKChainedActionScopeContext.Provider>
  );
}

/**
 * Marks terminal actions nested inside a chained workflow. Callback actions in
 * this subtree use the palette's normal close behavior instead of returning to
 * the surrounding chain anchor.
 */
export function CMDKTerminalActionScope({children}: {children: React.ReactNode}) {
  return (
    <CMDKChainedActionScopeContext.Provider value={null}>
      {children}
    </CMDKChainedActionScopeContext.Provider>
  );
}

export function useCMDKChainedActionScope(): CMDKChainedActionAnchor | null {
  return useContext(CMDKChainedActionScopeContext);
}

export const CMDKEnclosingActionProvider = CMDKEnclosingActionContext.Provider;
