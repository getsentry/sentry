import SearchBar from 'sentry/components/events/searchBar';
import type {SmartSearchBarProps} from 'sentry/components/smartSearchBar';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';

interface TracesSearchBarProps {
  handleSearch: SmartSearchBarProps['onSearch'];
  query: string;
}

export function TracesSearchBar({query, handleSearch}: TracesSearchBarProps) {
  // TODO: load tags for autocompletion
  const organization = useOrganization();
  return (
    <SearchBar
      query={query}
      onSearch={handleSearch}
      placeholder={t('Filter by tags')}
      organization={organization}
    />
  );
}
