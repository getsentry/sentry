import {useState} from 'react';
import styled from '@emotion/styled';

import {Button, LinkButton} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {SearchBar} from 'sentry/components/searchBar';
import {IconSort} from 'sentry/icons';
import {IconAdd} from 'sentry/icons/iconAdd';
import {t} from 'sentry/locale';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {SortOption} from 'sentry/views/explore/hooks/useGetSavedQueries';
import {isLogsEnabled} from 'sentry/views/explore/logs/isLogsEnabled';
import {getLogsUrl} from 'sentry/views/explore/logs/utils';
import {getExploreUrl} from 'sentry/views/explore/utils';
import {useHasPageFrameFeature} from 'sentry/views/navigation/useHasPageFrameFeature';

import {SavedQueriesTable} from './savedQueriesTable';

type Option = {label: string; value: SortOption};

export function SavedQueriesLandingContent() {
  const organization = useOrganization();
  const navigate = useNavigate();
  const location = useLocation();
  const hasPageFrameFeature = useHasPageFrameFeature();
  const hasLogsFeature = isLogsEnabled(organization);
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
        {hasPageFrameFeature ? (
          hasLogsFeature ? (
            <DropdownMenu
              items={[
                {
                  key: 'create-query-spans',
                  label: <span>{t('Trace Query')}</span>,
                  textValue: t('Create Traces Query'),
                  onAction: () => {
                    navigate(getExploreUrl({organization, visualize: []}));
                  },
                },
                {
                  key: 'create-query-logs',
                  label: <span>{t('Logs Query')}</span>,
                  textValue: t('Create Logs Query'),
                  onAction: () => {
                    navigate(getLogsUrl({organization}));
                  },
                },
              ]}
              trigger={triggerProps => (
                <Button
                  {...triggerProps}
                  priority="primary"
                  icon={<IconAdd />}
                  size="md"
                  aria-label={t('Create Query')}
                  onClick={e => {
                    e.stopPropagation();
                    e.preventDefault();

                    triggerProps.onClick?.(e);
                  }}
                >
                  {t('Create Query')}
                </Button>
              )}
            />
          ) : (
            <LinkButton
              priority="primary"
              icon={<IconAdd />}
              size="md"
              to={getExploreUrl({organization, visualize: []})}
            >
              {t('Create Query')}
            </LinkButton>
          )
        ) : null}
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
  margin-bottom: ${p => p.theme.space.xl};
  gap: ${p => p.theme.space.md};
  align-items: center;
`;

const SearchBarContainer = styled('div')`
  flex: 1;
`;
