import {createContext, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {useOmniSearchState} from '../useOmniState';

import {OmniResults} from './results';

export const OnmniSearchInputContext = createContext<
  React.Dispatch<React.SetStateAction<string>>
>(() => {});

function OmniSearchModal() {
  const searchState = useOmniSearchState();
  const [_search, setSearch] = useState('');

  const results = useMemo(() => {
    const {actions, areas, areaPriority} = searchState;
    return Object.values(areas)
      .sort(
        (a, b) =>
          areaPriority.findIndex(p => p === b.key) -
          areaPriority.findIndex(p => p === a.key)
      )
      .map(area => {
        return {
          key: area.key,
          label: area.label,
          actions: actions.filter(a => a.areaKey === area.key),
        };
      })
      .filter(area => area.actions.length);
  }, [searchState]);

  return (
    <Overlay>
      <OnmniSearchInputContext.Provider value={setSearch}>
        <OmniResults results={results} />
      </OnmniSearchInputContext.Provider>
    </Overlay>
  );
}

export {OmniSearchModal};

const Overlay = styled('div')`
  width: 100%;
`;
