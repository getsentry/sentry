import {useState} from 'react';
import styled from '@emotion/styled';

import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {CompactSelect} from 'sentry/components/core/compactSelect';
import SearchBar from 'sentry/components/searchBar';
import {IconSort} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import type {SortOption} from 'sentry/views/explore/hooks/useGetSavedQueries';

import {SavedQueriesTable} from './savedQueriesTable';

type Option = {label: string; value: SortOption};

export function SavedQueriesLandingContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const searchQuery = decodeScalar(location.query.query);
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
            onSearch={newQuery => {
              navigate({
                pathname: location.pathname,
                query: {...location.query, query: newQuery},
              });
            }}
            defaultQuery={searchQuery}
            placeholder={t('Search for a query')}
          />
        </SearchBarContainer>
        <CompactSelect
          trigger={triggerProps => (
            <OverlayTrigger.Button {...triggerProps} icon={<IconSort />} size="md">
              {sortOptions.find(option => option.value === sort)?.label ??
                triggerProps.children}
            </OverlayTrigger.Button>
          )}
          options={sortOptions}
          value={sort}
          onChange={option => setSort(option.value)}
        />
      </FilterContainer>
      <SavedQueriesTable
        mode="owned"
        perPage={20}
        cursorKey="ownedCursor"
        sort={sort}
        searchQuery={searchQuery}
        title={t('Created by Me')}
        hideIfEmpty
      />
      <SavedQueriesTable
        mode="shared"
        perPage={20}
        cursorKey="sharedCursor"
        sort={sort}
        searchQuery={searchQuery}
        title={t('Created by Others')}
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
