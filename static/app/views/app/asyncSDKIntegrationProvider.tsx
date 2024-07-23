import {createContext, useContext, useState} from 'react';
import type {addIntegration} from '@sentry/react';

type Integration = Parameters<typeof addIntegration>[0];

type State = Record<string, Integration | undefined>;

type Context = {
  setState: React.Dispatch<React.SetStateAction<State>>;
  state: State;
};

const context = createContext<Context>({
  setState: () => {},
  state: {},
});

export function AsyncSDKIntegrationContextProvider({
  children,
  outerContext,
}: {
  children: React.ReactNode;
  outerContext?: Context;
}) {
  const [state, setState] = useState<State>({});
  return (
    <context.Provider value={outerContext ?? {setState, state}}>
      {children}
    </context.Provider>
  );
}

export default function useAsyncSDKIntegrationStore(): Context {
  return useContext(context);
}
