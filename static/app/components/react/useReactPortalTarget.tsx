import {createContext, type ReactNode, useContext} from 'react';

const ReactPortalTarget = createContext<HTMLElement | ShadowRoot>(document.body);

interface Props {
  children: ReactNode;
  target: HTMLElement | ShadowRoot;
}

export function ReactPortalTargetProvider({children, target}: Props) {
  return (
    <ReactPortalTarget.Provider value={target}>{children}</ReactPortalTarget.Provider>
  );
}

export default function useReactPortalTarget() {
  return useContext(ReactPortalTarget);
}
