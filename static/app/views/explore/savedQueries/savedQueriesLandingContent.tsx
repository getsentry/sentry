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
  const [sort, setSort] = useState<SortOption>('recentlyViewed');
  const sortOptions: Option[] = [
    {value: 'recentlyViewed', label: t('Recently Viewed')},
    {value: 'name', label: t('Name')},
    {value: 'dateAdded', label: t('Date Added')},
    {value: 'dateUpdated', label: t('Date Updated')},
    {value: 'mostPopular', label: t('Most Popular')},
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
      {searchQuery.length > 0 ? (
        <span>
          <SavedQueriesTable
            mode="all"
            perPage={15}
            sort={sort}
            searchQuery={searchQuery}
          />
        </span>
      ) : (
        <span>
          <h4>{t('Owned by Me')}</h4>
          <SavedQueriesTable
            mode="owned"
            perPage={5}
            cursorKey="ownedCursor"
            sort={sort}
          />
          <h4>{t('Shared with Me')}</h4>
          <SavedQueriesTable
            mode="shared"
            perPage={8}
            cursorKey="sharedCursor"
            sort={sort}
          />
        </span>
      )}
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
