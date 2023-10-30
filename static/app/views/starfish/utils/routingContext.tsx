import {createContext, useContext} from 'react';

interface RoutingContextValue {
  baseURL: string;
}

const DEFAULT_VALUE = {
  baseURL: '/starfish',
};

const RoutingContext = createContext<RoutingContextValue>(DEFAULT_VALUE);

interface Props {
  children: React.ReactNode;
  value?: RoutingContextValue;
}

export const useRoutingContext = () => useContext(RoutingContext);

export function RoutingContextProvider({value, children}: Props) {
  return (
    <RoutingContext.Provider value={value ?? DEFAULT_VALUE}>
      {children}
    </RoutingContext.Provider>
  );
}
