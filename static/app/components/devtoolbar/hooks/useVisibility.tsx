import type {CSSProperties, Dispatch, ReactNode, SetStateAction} from 'react';
import {createContext, useContext, useState} from 'react';

type State = CSSProperties['visibility'];

const VisibilityContext = createContext<[State, Dispatch<SetStateAction<State>>]>([
  'visible',
  () => {},
]);

export function VisibilityContextProvider({children}: {children: ReactNode}) {
  const state = useState<State>('visible');
  return <VisibilityContext value={state}>{children}</VisibilityContext>;
}

export default function useVisibility() {
  return useContext(VisibilityContext);
}
