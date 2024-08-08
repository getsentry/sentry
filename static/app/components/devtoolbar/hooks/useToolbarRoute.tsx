import {createContext, useCallback, useContext, useState} from 'react';

type State = {
  activePanel:
    | null
    | 'alerts'
    | 'feedback'
    | 'issues'
    | 'featureFlags'
    | 'releases'
    | 'replay';
};

const context = createContext<{
  setActivePanel: (activePanel: State['activePanel']) => void;
  state: State;
}>({
  setActivePanel(_activePanel: State['activePanel']) {},
  state: {activePanel: null},
});

export function ToolbarRouterContextProvider({children}: {children: React.ReactNode}) {
  // TODO: if state gets more complex, we can swtich to useReducer
  const [state, setState] = useState<State>({activePanel: null});

  const setActivePanel = useCallback(
    (activePanel: State['activePanel']) => {
      setState(prev => ({
        ...prev,
        activePanel,
      }));
    },
    [setState]
  );

  return <context.Provider value={{setActivePanel, state}}>{children}</context.Provider>;
}

export default function useToolbarRoute() {
  return useContext(context);
}
