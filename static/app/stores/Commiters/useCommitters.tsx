import {useContext} from 'react';

import {CommittersContext} from './committersProvider';
import {CommittersAction, CommittersState} from './committersReducer';

export function useCommitters(): [CommittersState, React.Dispatch<CommittersAction>] {
  const context = useContext(CommittersContext);

  if (!context) {
    throw new Error('useCommitters called outside of CommittersContext.Provider');
  }

  return context;
}
