import {
  SearchQueryBuilder,
  type SearchQueryBuilderProps,
} from 'sentry/components/searchQueryBuilder';
import {t} from 'sentry/locale';
import {useDetectorFilterKeys} from 'sentry/views/detectors/utils/useDetectorFilterKeys';

interface DetectorSearchProps extends Partial<SearchQueryBuilderProps> {
  initialQuery: string;
  onSearch: (query: string) => void;
  /**
   * Detector filter keys to exclude
   */
  excludeKeys?: string[];
}

export function DetectorSearch({excludeKeys, ...props}: DetectorSearchProps) {
  const {filterKeys, getFieldDefinition} = useDetectorFilterKeys({excludeKeys});

  return (
    <SearchQueryBuilder
      placeholder={t('Search for monitors')}
      filterKeys={filterKeys}
      getTagValues={() => Promise.resolve([])}
      searchSource="detectors-list"
      fieldDefinitionGetter={getFieldDefinition}
      disallowUnsupportedFilters
      disallowLogicalOperators
      replaceRawSearchKeys={['name']}
      {...props}
    />
  );
}
