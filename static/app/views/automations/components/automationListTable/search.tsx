import {SearchQueryBuilder} from 'sentry/components/searchQueryBuilder';
import {t} from 'sentry/locale';
import {useAutomationFilterKeys} from 'sentry/views/automations/utils/useAutomationFilterKeys';

type AutomationSearchProps = {
  initialQuery: string;
  onSearch: (query: string) => void;
};

export function AutomationSearch({initialQuery, onSearch}: AutomationSearchProps) {
  const {filterKeys, getFieldDefinition} = useAutomationFilterKeys();

  return (
    <SearchQueryBuilder
      initialQuery={initialQuery}
      placeholder={t('Search for alerts')}
      onSearch={onSearch}
      filterKeys={filterKeys}
      getTagValues={() => Promise.resolve([])}
      searchSource="automations-list"
      fieldDefinitionGetter={getFieldDefinition}
      disallowUnsupportedFilters
      disallowWildcard
      disallowLogicalOperators
    />
  );
}
