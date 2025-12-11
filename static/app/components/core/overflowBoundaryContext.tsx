import {createContext, useContext} from 'react';

const OverflowBoundaryContext = createContext<string | null>(null);

export const OverflowBoundaryContextProvider = OverflowBoundaryContext.Provider;

export const useOverflowBoundaryContext = () => {
  return useContext(OverflowBoundaryContext);
};
