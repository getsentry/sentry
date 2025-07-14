import {SearchQueryBuilder} from 'sentry/components/searchQueryBuilder';
import {t} from 'sentry/locale';
import type {TagCollection} from 'sentry/types/group';
import type {FieldDefinition} from 'sentry/utils/fields';
import {FieldKind} from 'sentry/utils/fields';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {AUTOMATION_FILTER_KEYS} from 'sentry/views/automations/constants';

function getAutomationFilterKeyDefinition(filterKey: string): FieldDefinition | null {
  if (
    AUTOMATION_FILTER_KEYS.hasOwnProperty(filterKey) &&
    AUTOMATION_FILTER_KEYS[filterKey]
  ) {
    const {description, valueType, keywords, values} = AUTOMATION_FILTER_KEYS[filterKey];

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
  Object.keys(AUTOMATION_FILTER_KEYS).map(key => {
    const {values} = AUTOMATION_FILTER_KEYS[key] ?? {};

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

export function AutomationSearch() {
  const location = useLocation();
  const navigate = useNavigate();
  const query = typeof location.query.query === 'string' ? location.query.query : '';

  return (
    <SearchQueryBuilder
      initialQuery={query}
      placeholder={t('Search for automations')}
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
      searchSource="automations-list"
      fieldDefinitionGetter={getAutomationFilterKeyDefinition}
      disallowUnsupportedFilters
      disallowWildcard
      disallowLogicalOperators
    />
  );
}
