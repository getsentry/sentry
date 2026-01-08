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
};

function IssueSearchBar({query, onSearch, className}: IssueSearchProps) {
  const organization = useOrganization();
  const {displayAskSeer} = useSearchQueryBuilder();

  if (displayAskSeer) {
    // IssueListSeerComboBox handles navigation directly to apply both query and sort
    return <IssueListSeerComboBox />;
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

export function IssueSearch({query, onSearch, className}: IssueSearchProps) {
  const organization = useOrganization();
  const {selection: pageFilters} = usePageFilters();
  const {getFilterKeys, getFilterKeySections, getTagValues} =
    useIssueListSearchBarDataProvider({pageFilters});

  // Gate behind gen-ai-search-agent-translate (internal only) plus standard AI consent checks
  const areAiFeaturesAllowed =
    !organization?.hideAiFeatures &&
    organization.features.includes('gen-ai-features') &&
    organization.features.includes('gen-ai-search-agent-translate');

  return (
    <SearchQueryBuilderProvider
      initialQuery={query || ''}
      filterKeys={getFilterKeys()}
      filterKeySections={getFilterKeySections()}
      getTagValues={getTagValues}
      searchSource="main_search"
      enableAISearch={areAiFeaturesAllowed}
      onSearch={onSearch}
      recentSearches={SavedSearchType.ISSUE}
      disallowLogicalOperators
    >
      <IssueSearchBar query={query} onSearch={onSearch} className={className} />
    </SearchQueryBuilderProvider>
  );
}
