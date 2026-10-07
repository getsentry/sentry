import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {
  SearchQueryBuilderProvider,
  useSearchQueryBuilderAI,
  useSearchQueryBuilderState,
} from 'sentry/components/searchQueryBuilder/context';
import {t} from 'sentry/locale';
import {SavedSearchType} from 'sentry/types/group';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {getIssueViewQueryParams} from 'sentry/views/issueList/issueViews/getIssueViewQueryParams';
import {IssueViewSaveButton} from 'sentry/views/issueList/issueViews/issueViewSaveButton';
import {useIssueViewUnsavedChanges} from 'sentry/views/issueList/issueViews/useIssueViewUnsavedChanges';
import {useSelectedGroupSearchView} from 'sentry/views/issueList/issueViews/useSelectedGroupSeachView';
import type {IssueSortOptions} from 'sentry/views/issueList/utils';

import {IssueListSeerComboBox} from './issueListSeerComboBox';
import {IssueListSearchBar, useIssueListSearchBarDataProvider} from './searchBar';

type IssueSearchProps = {
  onSearch: (query: string) => void;
  query: string;
  sort: IssueSortOptions;
  className?: string;
};

function IssueSearchBar({query, sort, onSearch, className}: IssueSearchProps) {
  const organization = useOrganization();
  const {displayAskSeer} = useSearchQueryBuilderAI();
  const {query: draftQuery, dispatch, handleSearch} = useSearchQueryBuilderState();
  const {data: view} = useSelectedGroupSearchView();
  const savedQuery = view?.query ?? query;
  const location = useLocation();
  const navigate = useNavigate();
  const {hasUnsavedChanges} = useIssueViewUnsavedChanges();

  if (displayAskSeer) {
    return (
      <Flex gap="sm" align="center">
        <IssueListSeerComboBox className={className} />
        <IssueViewSaveButton query={query} sort={sort} />
      </Flex>
    );
  }

  return (
    <IssueListSearchBar
      className={className}
      searchSource="main_search"
      organization={organization}
      initialQuery={query || ''}
      onSearch={onSearch}
      placeholder={t('Search for events, users, tags, and more')}
      showClearButton={false}
      trailingItems={
        <Flex gap="xs" align="center">
          <Button
            size="sm"
            variant="transparent"
            disabled={draftQuery === savedQuery && !hasUnsavedChanges}
            onClick={() => {
              dispatch({type: 'UPDATE_QUERY', query: savedQuery});
              if (view) {
                navigate({
                  pathname: location.pathname,
                  query: getIssueViewQueryParams({view}),
                });
              } else {
                handleSearch(savedQuery);
              }
            }}
          >
            {t('Clear')}
          </Button>
          <IssueViewSaveButton
            query={draftQuery}
            sort={sort}
            onSave={() => handleSearch(draftQuery)}
          />
        </Flex>
      }
    />
  );
}

export function IssueSearch({query, sort, onSearch, className}: IssueSearchProps) {
  const {selection: pageFilters} = usePageFilters();
  const {getFilterKeys, getFilterKeySections, getTagValues} =
    useIssueListSearchBarDataProvider({pageFilters});

  const organization = useOrganization();
  const hasTranslateEndpoint =
    organization.features.includes('gen-ai-search-agent-translate') &&
    organization.features.includes('gen-ai-issues-search');

  return (
    <SearchQueryBuilderProvider
      initialQuery={query || ''}
      filterKeys={getFilterKeys()}
      filterKeySections={getFilterKeySections()}
      getTagValues={getTagValues}
      searchSource="main_search"
      enableAISearch={hasTranslateEndpoint}
      onSearch={onSearch}
      recentSearches={SavedSearchType.ISSUE}
      disallowLogicalOperators
    >
      <IssueSearchBar
        query={query}
        sort={sort}
        onSearch={onSearch}
        className={className}
      />
    </SearchQueryBuilderProvider>
  );
}
