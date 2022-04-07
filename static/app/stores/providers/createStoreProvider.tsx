import React, {FunctionComponent, ReactNode, useEffect, useState} from 'react';
import {Store} from 'reflux';

import {createDefinedContext} from 'sentry/utils/performance/contexts/utils';

import {CommonStoreDefinition} from '../types';

type Actions<T> = Partial<T>;
type GenericContext<S, SS, A extends Actions<S>> = {
  actions: A;
  state: Readonly<SS>;
};

export const createStoreProvider = <
  State,
  LegacyStore extends CommonStoreDefinition<State> & Store,
  A
>({
  name,
  store,
  actions,
}: {
  actions: A;
  name: string;
  store: LegacyStore;
}): [
  FunctionComponent,
  () => GenericContext<LegacyStore, State, A>,
  React.Context<GenericContext<LegacyStore, State, A>>
] => {
  const [_StoreProvider, _useStore, Context] = createDefinedContext<
    GenericContext<LegacyStore, State, A>
  >({
    name,
  });

  const StoreProvider = ({children}: {children?: ReactNode}) => {
    const [_signal, setSignal] = useState({});
    useEffect(() => {
      const unsubscribe = store.listen(() => setSignal({}), this as any);
      return () => unsubscribe();
    });
    return (
      <_StoreProvider value={{state: Object.freeze(store.getState()), actions}}>
        {children}
      </_StoreProvider>
    );
  };
  const useStore = _useStore;

  return [StoreProvider, useStore, Context];
};
