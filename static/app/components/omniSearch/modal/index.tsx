import {createContext, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import sortBy from 'lodash/sortBy';

import {t} from 'sentry/locale';
import {createFuzzySearch, Fuse} from 'sentry/utils/fuzzySearch';

import {OmniAction, OmniSection} from '../types';
import {useOmniSearchState} from '../useOmniState';

import {OmniResults} from './results';

export const OnmniSearchInputContext = createContext<
  React.Dispatch<React.SetStateAction<string>>
>(() => {});

function OmniSearchModal() {
  const searchState = useOmniSearchState();
  const [search, setSearch] = useState('');
  const fuse = useRef<Fuse<OmniAction>>();

  useEffect(() => {
    async function initializeFuse() {
      const {actions} = searchState;
      fuse.current = await createFuzzySearch(actions, {
        keys: ['label'],
        threshold: 0.8,
      });
    }

    initializeFuse();
  }, [searchState]);

  const results = useMemo(() => {
    const {actions, areas, areaPriority, focusedArea} = searchState;
    const hasSearch = search.length > 1;
    const searchResults = hasSearch
      ? fuse.current?.search(search).map(r => r.item)
      : actions;

    const topSearchResults: OmniSection[] = [
      {
        key: 'top-search-results',
        'aria-label': t('Top results'),
        actions:
          searchResults?.slice(0, 5).map(action => ({
            ...action,
            actionType: 'top-result',
            key: `top-result-${action.key}`,
          })) ?? [],
      },
    ];

    const searchResultsByArea: OmniSection[] = Object.values(areas)
      .sort(
        (a, b) =>
          areaPriority.findIndex(p => p === b.key) -
          areaPriority.findIndex(p => p === a.key)
      )
      .map(area => {
        return {
          key: area.key,
          label: area.key === focusedArea?.key ? null : area.label,
          actions: sortBy(
            searchResults?.filter(a => a.areaKey === area.key) ?? [],
            action => action.actionType
          ),
        };
      })
      .filter(area => area.actions?.length);

    const allResults = hasSearch
      ? [...topSearchResults, ...searchResultsByArea]
      : searchResultsByArea;

    return allResults;
  }, [search, searchState]);

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
