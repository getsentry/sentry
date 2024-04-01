import type {SmartSearchBarProps} from 'sentry/components/smartSearchBar';
import SmartSearchBar from 'sentry/components/smartSearchBar';
import {t} from 'sentry/locale';

interface TracesSearchBarProps {
  handleSearch: SmartSearchBarProps['onSearch'];
  query: string;
}

export function TracesSearchBar({query, handleSearch}: TracesSearchBarProps) {
  // TODO: load tags for autocompletion
  return (
    <SmartSearchBar
      query={query}
      onSearch={handleSearch}
      placeholder={t('Filter by tags')}
    />
  );
}
