import {createContext, useContext, useReducer} from 'react';

function assertNever(x: never) {
  throw new TypeError('Unhandled sidebar reducer action: ' + x);
}

import {SidebarPanelKey} from 'sentry/components/sidebar/types';

type State = SidebarPanelKey | '';

type ShowPanelAction = {payload: SidebarPanelKey; type: 'show panel'};
type HidePanelAction = {type: 'hide panel'};
type SidebarAction = HidePanelAction | ShowPanelAction;

const SidebarContext = createContext<State | null>(null);
const SidebarDispatchContext = createContext<React.Dispatch<SidebarAction> | null>(null);

export function SidebarReducer(state: State, action: SidebarAction) {
  switch (action.type) {
    case 'show panel':
      return action.payload;
    case 'hide panel':
      return '';
    default:
      assertNever(action);
      return state;
  }
}

interface Props {
  children: React.ReactNode;
  initialPanel?: State;
}

export function SidebarProvider(props: Props) {
  const [state, dispatch] = useReducer(SidebarReducer, props.initialPanel ?? '');

  return (
    <SidebarDispatchContext.Provider value={dispatch}>
      <SidebarContext.Provider value={state}>{props.children}</SidebarContext.Provider>
    </SidebarDispatchContext.Provider>
  );
}

export function useSidebarDispatch() {
  const context = useContext(SidebarDispatchContext);
  if (context === null) {
    throw new Error('useSidebarDispatch was called outside of SidebarDispatchProvider');
  }
  return context;
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (context === null) {
    throw new Error('useSidebar was called outside of SidebarProvider');
  }
  return context;
}
