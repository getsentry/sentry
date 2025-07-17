import {SearchQueryBuilder} from 'sentry/components/searchQueryBuilder';
import {t} from 'sentry/locale';
import type {TagCollection} from 'sentry/types/group';
import type {FieldDefinition} from 'sentry/utils/fields';
import {FieldKind} from 'sentry/utils/fields';
import {DETECTOR_FILTER_KEYS} from 'sentry/views/detectors/constants';

type DetectorSearchProps = {
  initialQuery: string;
  onSearch: (query: string) => void;
};

function getDetectorFilterKeyDefinition(filterKey: string): FieldDefinition | null {
  if (DETECTOR_FILTER_KEYS.hasOwnProperty(filterKey) && DETECTOR_FILTER_KEYS[filterKey]) {
    const {description, valueType, keywords, values} = DETECTOR_FILTER_KEYS[filterKey];

    return {
      kind: FieldKind.FIELD,
      desc: description,
      valueType,
      keywords,
      values,
    };
  }

  return null;
}

const FILTER_KEYS: TagCollection = Object.fromEntries(
  Object.keys(DETECTOR_FILTER_KEYS).map(key => {
    const {values} = DETECTOR_FILTER_KEYS[key] ?? {};

    return [
      key,
      {
        key,
        name: key,
        predefined: values !== undefined,
        values,
      },
    ];
  })
);

export function DetectorSearch({initialQuery, onSearch}: DetectorSearchProps) {
  return (
    <SearchQueryBuilder
      initialQuery={initialQuery}
      placeholder={t('Search for monitors')}
      onSearch={onSearch}
      filterKeys={FILTER_KEYS}
      getTagValues={() => Promise.resolve([])}
      searchSource="detectors-list"
      fieldDefinitionGetter={getDetectorFilterKeyDefinition}
      disallowUnsupportedFilters
      disallowWildcard
      disallowLogicalOperators
    />
  );
}
