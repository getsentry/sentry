import {createContext, useContext, useReducer} from 'react';

function assertNever(x: never) {
  throw new TypeError('Unhandled sidebar reducer action: ' + x);
}

import {SidebarPanelKey} from 'sentry/components/sidebar/types';

type State = SidebarPanelKey | '';

type HidePanelAction = {type: 'hide panel'};
type TogglePanelAction = {payload: SidebarPanelKey; type: 'toggle panel'};
type ActivatePanelAction = {payload: SidebarPanelKey; type: 'activate panel'};
type SidebarAction = HidePanelAction | TogglePanelAction | ActivatePanelAction;

const SidebarContext = createContext<[State, React.Dispatch<SidebarAction>] | null>(null);

export function SidebarReducer(state: State, action: SidebarAction) {
  switch (action.type) {
    case 'activate panel':
      return action.payload;
    case 'hide panel':
      return '';
    case 'toggle panel':
      if (state === action.payload) {
        return '';
      }
      return action.payload;
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
  const reducer = useReducer(SidebarReducer, props.initialPanel ?? '');

  return (
    <SidebarContext.Provider value={reducer}>{props.children}</SidebarContext.Provider>
  );
}

export function useSidebarDispatch() {
  const context = useContext(SidebarContext);
  if (context === null) {
    throw new Error('useSidebarDispatch was called outside of SidebarProvider');
  }
  return context[1];
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (context === null) {
    throw new Error('useSidebar was called outside of SidebarProvider');
  }
  return context;
}
