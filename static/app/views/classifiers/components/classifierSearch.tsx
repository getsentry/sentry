import {SearchQueryBuilder} from 'sentry/components/searchQueryBuilder';
import type {FieldDefinitionGetter} from 'sentry/components/searchQueryBuilder/types';
import {t} from 'sentry/locale';
import type {TagCollection} from 'sentry/types/group';
import {FieldKind, FieldValueType, type FieldDefinition} from 'sentry/utils/fields';
import {CLASSIFIER_DATASETS} from 'sentry/views/classifiers/constants';

const CLASSIFIER_FIELD_DEFINITIONS: Record<string, FieldDefinition> = {
  name: {
    desc: 'Name of the classifier',
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
    keywords: ['title'],
  },
  attribute: {
    desc: 'Attribute the classifier writes its result to',
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
    keywords: ['result'],
  },
  status: {
    desc: 'Whether the classifier is enabled',
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
    allowWildcard: false,
    values: ['enabled', 'disabled'],
  },
  dataset: {
    desc: 'Data the classifier runs on',
    kind: FieldKind.FIELD,
    valueType: FieldValueType.STRING,
    allowWildcard: false,
    keywords: ['type'],
    values: [...CLASSIFIER_DATASETS],
  },
};

const PREDEFINED_KEYS = new Set(['status', 'dataset']);

const FILTER_KEYS: TagCollection = Object.fromEntries(
  Object.keys(CLASSIFIER_FIELD_DEFINITIONS).map(key => [
    key,
    {key, name: key, predefined: PREDEFINED_KEYS.has(key)},
  ])
);

const getFieldDefinition: FieldDefinitionGetter = key =>
  CLASSIFIER_FIELD_DEFINITIONS[key] ?? null;

interface ClassifierSearchProps {
  initialQuery: string;
  onSearch: (query: string) => void;
}

export function ClassifierSearch({initialQuery, onSearch}: ClassifierSearchProps) {
  return (
    <SearchQueryBuilder
      initialQuery={initialQuery}
      onSearch={onSearch}
      placeholder={t('Search for classifiers')}
      filterKeys={FILTER_KEYS}
      getTagValues={() => Promise.resolve([])}
      fieldDefinitionGetter={getFieldDefinition}
      searchSource="classifiers-list"
      disallowUnsupportedFilters
      disallowLogicalOperators
    />
  );
}
