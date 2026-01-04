import {
  SearchQueryBuilderProvider,
  useSearchQueryBuilder,
} from 'sentry/components/searchQueryBuilder/context';
import {t} from 'sentry/locale';
import {SavedSearchType} from 'sentry/types/group';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

import {IssueListSeerComboBox} from './issueListSeerComboBox';
import IssueListSearchBar, {useIssueListSearchBarDataProvider} from './searchBar';

type IssueSearchProps = {
  onSearch: (query: string) => void;
  query: string;
  className?: string;
  onSortChange?: (sort: string) => void;
};

function IssueSearchInner({
  query,
  onSearch,
  onSortChange,
  className,
}: {
  onSearch: (query: string) => void;
  query: string;
  className?: string;
  onSortChange?: (sort: string) => void;
}) {
  const organization = useOrganization();
  const {displayAskSeer} = useSearchQueryBuilder();

  if (displayAskSeer) {
    return <IssueListSeerComboBox onSearch={onSearch} onSortChange={onSortChange} />;
  }

  return (
    <IssueListSearchBar
      className={className}
      searchSource="main_search"
      organization={organization}
      initialQuery={query || ''}
      onSearch={onSearch}
      placeholder={t('Search for events, users, tags, and more')}
    />
  );
}

export function IssueSearch({
  query,
  onSearch,
  className,
  onSortChange,
}: IssueSearchProps) {
  const organization = useOrganization();
  const {selection: pageFilters} = usePageFilters();

  const isAISearchEnabled =
    !organization.hideAiFeatures &&
    organization.features.includes('gen-ai-search-agent-translate');

  const {getFilterKeys, getFilterKeySections, getTagValues} =
    useIssueListSearchBarDataProvider({pageFilters});

  // When AI search is not enabled, render IssueListSearchBar directly
  if (!isAISearchEnabled) {
    return (
      <IssueListSearchBar
        className={className}
        searchSource="main_search"
        organization={organization}
        initialQuery={query || ''}
        onSearch={onSearch}
        placeholder={t('Search for events, users, tags, and more')}
      />
    );
  }

  // When AI search is enabled, wrap with SearchQueryBuilderProvider
  // so we can check displayAskSeer and conditionally render AI search
  return (
    <SearchQueryBuilderProvider
      enableAISearch={isAISearchEnabled}
      initialQuery={query || ''}
      filterKeys={getFilterKeys()}
      filterKeySections={getFilterKeySections()}
      getTagValues={getTagValues}
      recentSearches={SavedSearchType.ISSUE}
      disallowLogicalOperators
      searchSource="main_search"
      onSearch={onSearch}
    >
      <IssueSearchInner
        query={query}
        onSearch={onSearch}
        onSortChange={onSortChange}
        className={className}
      />
    </SearchQueryBuilderProvider>
  );
}
