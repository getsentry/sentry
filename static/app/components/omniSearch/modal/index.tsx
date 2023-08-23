import {useMemo} from 'react';
import styled from '@emotion/styled';

import {useOmniSearchState} from '../useOmniState';

import {OmniResults} from './results';

function OmniSearchModal() {
  const searchState = useOmniSearchState();

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
      <OmniResults results={results} />
    </Overlay>
  );
}

export {OmniSearchModal};

const Overlay = styled('div')`
  width: 100%;
`;
