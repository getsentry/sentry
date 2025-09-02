import {SearchQueryBuilder} from 'sentry/components/searchQueryBuilder';
import {t} from 'sentry/locale';
import {useDetectorFilterKeys} from 'sentry/views/detectors/utils/useDetectorFilterKeys';

type DetectorSearchProps = {
  initialQuery: string;
  onSearch: (query: string) => void;
};

export function DetectorSearch({initialQuery, onSearch}: DetectorSearchProps) {
  const {filterKeys, getFieldDefinition} = useDetectorFilterKeys();

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
      disallowLogicalOperators
      replaceRawSearchKeys={['name']}
    />
  );
}
