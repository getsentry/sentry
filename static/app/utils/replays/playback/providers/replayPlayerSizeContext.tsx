import {
  createContext,
  type Dispatch,
  type SetStateAction,
  useContext,
  useState,
} from 'react';

type State = {
  height: number;
  scale: number;
  width: number;
};

const Context = createContext<[State, Dispatch<SetStateAction<State>>]>([
  {width: 0, height: 0, scale: 0},
  () => {},
]);

export function ReplayPlayerSizeContextProvider({children}: {children: React.ReactNode}) {
  const state = useState<State>({width: 0, height: 0, scale: 0});
  return <Context.Provider value={state}>{children}</Context.Provider>;
}

export function useReplayPlayerSize() {
  return useContext(Context);
}
