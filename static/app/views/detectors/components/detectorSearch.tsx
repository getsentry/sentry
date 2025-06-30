import {SearchQueryBuilder} from 'sentry/components/searchQueryBuilder';
import {t} from 'sentry/locale';
import type {TagCollection} from 'sentry/types/group';
import type {FieldDefinition} from 'sentry/utils/fields';
import {FieldKind} from 'sentry/utils/fields';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {DETECTOR_FILTER_KEYS} from 'sentry/views/detectors/constants';

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

export function DetectorSearch() {
  const location = useLocation();
  const navigate = useNavigate();
  const query = typeof location.query.query === 'string' ? location.query.query : '';

  return (
    <SearchQueryBuilder
      initialQuery={query}
      placeholder={t('Search for monitors')}
      onSearch={searchQuery => {
        navigate({
          pathname: location.pathname,
          query: {
            ...location.query,
            query: searchQuery,
          },
        });
      }}
      filterKeys={FILTER_KEYS}
      getTagValues={() => Promise.resolve([])}
      searchSource="detectors-list"
      fieldDefinitionGetter={getDetectorFilterKeyDefinition}
      disallowUnsupportedFilters
      disallowWildcard
      disallowLogicalOperators
      searchOnChange
    />
  );
}
