import type {Dispatch, ReactNode, SetStateAction} from 'react';
import {createContext, useContext, useState} from 'react';

type ContextType = [undefined | number, Dispatch<SetStateAction<number | undefined>>];

const Context = createContext<ContextType>([undefined, () => {}]);

export function ReplayCurrentTimeContextProvider({children}: {children: ReactNode}) {
  const state = useState<undefined | number>(undefined);

  return <Context value={state}>{children}</Context>;
}

export default function useCurrentHoverTime() {
  return useContext(Context);
}
