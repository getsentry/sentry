import type {Dispatch, ReactNode, SetStateAction} from 'react';
import {createContext, useContext, useState} from 'react';

type State = 'visible' | 'hidden';

const VisibilityContext = createContext<[State, Dispatch<SetStateAction<State>>]>([
  'visible',
  () => {},
]);

export function VisibilityContextProvider({children}: {children: ReactNode}) {
  const state = useState<State>('visible');
  return (
    <VisibilityContext.Provider value={state}>{children}</VisibilityContext.Provider>
  );
}

export default function useVisibility() {
  return useContext(VisibilityContext);
}
