import type {Dispatch, ReactNode, SetStateAction} from 'react';
import {createContext, useContext, useState} from 'react';

type ContextType = [undefined | number, Dispatch<SetStateAction<number | undefined>>];

const context = createContext<ContextType>([undefined, () => {}]);

export function ReplayCurrentTimeContextProvider({children}: {children: ReactNode}) {
  const state = useState<undefined | number>(undefined);

  return <context.Provider value={state}>{children}</context.Provider>;
}

export default function useCurrentHoverTime() {
  return useContext(context);
}
