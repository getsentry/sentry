import {useState} from 'react';
import styled from '@emotion/styled';

import {CompactSelect} from 'sentry/components/core/compactSelect';
import SearchBar from 'sentry/components/searchBar';
import {IconSort} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {SortOption} from 'sentry/views/explore/hooks/useGetSavedQueries';

import {SavedQueriesTable} from './savedQueriesTable';

type Option = {label: string; value: SortOption};

export function SavedQueriesLandingContent() {
  const [searchQuery, setSearchQuery] = useState('');
  const [sort, setSort] = useState<SortOption>('mostStarred');
  const sortOptions: Option[] = [
    {value: 'mostStarred', label: t('Most Starred')},
    {value: 'recentlyViewed', label: t('Recently Viewed')},
    {value: 'name', label: t('Name A-Z')},
    {value: '-name', label: t('Name Z-A')},
    {value: '-dateAdded', label: t('Created (Newest)')},
    {value: 'dateAdded', label: t('Created (Oldest)')},
  ];
  return (
    <div>
      <FilterContainer>
        <SearchBarContainer>
          <SearchBar
            onChange={setSearchQuery}
            value={searchQuery}
            placeholder={t('Search for a query')}
          />
        </SearchBarContainer>
        <CompactSelect
          triggerProps={{
            icon: <IconSort />,
            size: 'md',
          }}
          triggerLabel={sortOptions.find(option => option.value === sort)?.label}
          options={sortOptions}
          value={sort}
          onChange={option => setSort(option.value)}
        />
      </FilterContainer>
      <h4>{t('Created by Me')}</h4>
      <SavedQueriesTable
        mode="owned"
        perPage={20}
        cursorKey="ownedCursor"
        sort={sort}
        searchQuery={searchQuery}
      />
      <h4>{t('Created by Others')}</h4>
      <SavedQueriesTable
        mode="shared"
        perPage={20}
        cursorKey="sharedCursor"
        sort={sort}
        searchQuery={searchQuery}
      />
    </div>
  );
}
const FilterContainer = styled('div')`
  display: flex;
  margin-bottom: ${space(2)};
  gap: ${space(2)};
`;

const SearchBarContainer = styled('div')`
  flex: 1;
`;
