import {SearchQueryBuilder} from 'sentry/components/searchQueryBuilder';
import {t} from 'sentry/locale';
import {getFieldDefinition} from 'sentry/utils/fields';
import {useDetectorFilterKeys} from 'sentry/views/detectors/utils/useDetectorFilterKeys';

type DetectorSearchProps = {
  initialQuery: string;
  onSearch: (query: string) => void;
};

export function DetectorSearch({initialQuery, onSearch}: DetectorSearchProps) {
  const filterKeys = useDetectorFilterKeys();

  return (
    <SearchQueryBuilder
      initialQuery={initialQuery}
      placeholder={t('Search for monitors')}
      onSearch={onSearch}
      filterKeys={filterKeys}
      getTagValues={() => Promise.resolve([])}
      searchSource="detectors-list"
      fieldDefinitionGetter={getFieldDefinition}
      disallowUnsupportedFilters
      disallowWildcard
      disallowLogicalOperators
    />
  );
}
