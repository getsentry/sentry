import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';

import IssueListSearchBar from './searchBar';

type IssueSearchWithSavedSearchesProps = {
  onSearch: (query: string) => void;
  query: string;
  className?: string;
};

export function IssueSearch({
  query,
  onSearch,
  className,
}: IssueSearchWithSavedSearchesProps) {
  const organization = useOrganization();

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
