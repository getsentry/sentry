import {createContext, useReducer} from 'react';

import {CommittersAction, committersReducer, CommittersState} from './committersReducer';

export const CommittersContext = createContext<
  [CommittersState, React.Dispatch<CommittersAction>] | null
>(null);

interface CommittersContextProviderProps {
  children: React.ReactNode;
  initialState?: CommittersState;
}

export function CommittersProvider(props: CommittersContextProviderProps) {
  const contextValue = useReducer(committersReducer, props.initialState ?? {});

  return (
    <CommittersContext.Provider value={contextValue}>
      {props.children}
    </CommittersContext.Provider>
  );
}
