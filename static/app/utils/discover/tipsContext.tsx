import {createContext} from 'react';

export type TipsContextValue = {tips: string[]};

export const TipsContext = createContext<
  [TipsContextValue, React.Dispatch<React.SetStateAction<TipsContextValue>>] | null
>(null);
