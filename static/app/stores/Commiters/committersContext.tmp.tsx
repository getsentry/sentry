import {createContext} from 'react';

import {CommittersAction, CommittersState} from './committersReducer';

export const CommittersContext = createContext<
  [CommittersState, React.Dispatch<CommittersAction>] | null
>(null);
