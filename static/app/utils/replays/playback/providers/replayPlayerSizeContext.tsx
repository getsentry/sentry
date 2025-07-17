import {
  createContext,
  type Dispatch,
  type SetStateAction,
  useContext,
  useState,
} from 'react';

type State = {
  /**
   * The scaled height of the player
   */
  height: number;

  /**
   * The scale factor of the player
   *
   * The scale may be clamped so we don't scale the original replay to be too large or too small.
   */
  scale: number;

  /**
   * The scaled width of the player
   */
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

/**
 * The scaled width and height of the player, along with the scale factor.
 *
 * To get the original width and height, multiply the scaled width and height by the scale factor.
 * Or read from `useReplayPlayerState().dimensions`
 */
export function useReplayPlayerSize() {
  return useContext(Context);
}
