import {createContext, useContext} from 'react';
import {parseAsInteger, useQueryState} from 'nuqs';

const SelectedReplayIndexContext = createContext(0);

const parseAsSelectedReplayIndex = parseAsInteger
  .withDefault(0)
  .withOptions({clearOnDefault: false});

export function SelectedReplayIndexProvider({children}: {children: React.ReactNode}) {
  const [selectedReplayIndex] = useQueryState(
    'selected_replay_index',
    parseAsSelectedReplayIndex
  );

  return (
    <SelectedReplayIndexContext.Provider value={selectedReplayIndex}>
      {children}
    </SelectedReplayIndexContext.Provider>
  );
}

export function useSelectedReplayIndex() {
  const [, setSelectedReplayIndex] = useQueryState(
    'selected_replay_index',
    parseAsSelectedReplayIndex
  );

  const index = useContext(SelectedReplayIndexContext);

  return {index, select: setSelectedReplayIndex};
}
