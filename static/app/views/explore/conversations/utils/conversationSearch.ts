import type {useSpanSearchQueryBuilderProps} from 'sentry/components/performance/spanSearchQueryBuilder';
import type {GetTagValues} from 'sentry/components/searchQueryBuilder';
import {t} from 'sentry/locale';
import type {TagCollection} from 'sentry/types/group';
import {FieldKind, type FieldDefinition} from 'sentry/utils/fields';
import {CONVERSATION_FIELDS} from 'sentry/views/explore/conversations/hooks/useConversations';

type SpanSearchProviderProps = ReturnType<
  typeof useSpanSearchQueryBuilderProps
>['spanSearchQueryBuilderProviderProps'];

const CONVERSATION_FIELD_DEFINITIONS: Record<string, FieldDefinition> =
  Object.fromEntries(
    Object.values(CONVERSATION_FIELDS).map(({key, valueType, description}) => [
      key,
      {
        kind: FieldKind.FIELD,
        valueType,
        desc: description,
      },
    ])
  );

const CONVERSATION_FILTER_KEYS: TagCollection = Object.fromEntries(
  Object.values(CONVERSATION_FIELDS).map(({key}) => [
    key,
    {
      key,
      name: key,
      kind: FieldKind.MEASUREMENT,
    },
  ])
);

// Conversation fields mirror the columns of the conversations table, so they
// are surfaced above raw span attributes that happen to match the input more
// literally (e.g. `toolca` matching `ai.toolCall.args`).
const CONVERSATION_PRIORITIZED_FILTER_KEYS = Object.keys(CONVERSATION_FILTER_KEYS);

export const CONVERSATION_SEARCH_PLACEHOLDER = t(
  'Search by conversation ID, user, model, or message'
);

export const CONVERSATION_SEARCH_QUERY_BUILDER_PROPS = {
  disableRecentSearches: true,
  replaceRawSearchKeys: ['gen_ai.conversation.id', 'gen_ai.input.messages'],
  matchKeySuggestions: [
    {
      key: 'gen_ai.conversation.id',
      valuePattern: /^[0-9a-fA-F]{8,32}$/,
    },
    {key: 'gen_ai.conversation.id', valuePattern: /^resp_/},
    {key: 'trace', valuePattern: /^[0-9a-fA-F]{32}$/},
    {key: 'id', valuePattern: /^[0-9a-fA-F]{16}$/},
  ],
};

export function withConversationFields(providerProps: SpanSearchProviderProps) {
  // Value counts are span-level and can imply conversation results that the
  // list will not return. Strip them for conversation autocomplete.
  const getTagValuesWithoutCounts: GetTagValues = async params => {
    const values = await providerProps.getTagValues(params);
    return values.map(value =>
      typeof value === 'string' ? value : {value: value.value}
    );
  };

  const {fieldDefinitionGetter} = providerProps;
  return {
    ...providerProps,
    filterKeys: {
      ...providerProps.filterKeys,
      ...CONVERSATION_FILTER_KEYS,
    },
    filterKeySections: [
      {
        value: 'conversation',
        label: t('Conversation'),
        children: CONVERSATION_PRIORITIZED_FILTER_KEYS,
      },
      ...providerProps.filterKeySections,
    ],
    prioritizedFilterKeys: CONVERSATION_PRIORITIZED_FILTER_KEYS,
    fieldDefinitionGetter: (key: string, options?: {kind?: FieldKind}) =>
      CONVERSATION_FIELD_DEFINITIONS[key] ?? fieldDefinitionGetter(key, options),
    getTagValues: getTagValuesWithoutCounts,
  };
}
