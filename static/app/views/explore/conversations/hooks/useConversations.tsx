import {useMemo} from 'react';
import {useQuery} from '@tanstack/react-query';
import {parseAsStringLiteral, useQueryState} from 'nuqs';

import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {t} from 'sentry/locale';
import {apiOptions, selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {FieldValueType} from 'sentry/utils/fields';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useCombinedQuery} from 'sentry/views/insights/pages/agents/hooks/useCombinedQuery';
import {useTableCursor} from 'sentry/views/insights/pages/agents/hooks/useTableCursor';

export interface ConversationUser {
  email: string | null;
  id: string | null;
  ip_address: string | null;
  username: string | null;
}

export interface Conversation {
  conversationId: string;
  duration: number;
  endTimestamp: number;
  errors: number;
  firstInput: string | null;
  // Summed duration (ms) of the conversation's generation (ai_client) spans.
  generationDuration: number;
  inputTokens: number;
  lastOutput: string | null;
  llmCalls: number;
  outputTokens: number;
  // Project the conversation's first span belongs to (null when unknown).
  projectId: number | null;
  startTimestamp: number;
  // AI-generated summary of the conversation. Not always available (title
  // generation is gated and asynchronous), so consumers must fall back to the
  // first input message.
  title: string | null;
  toolCalls: number;
  toolErrors: number;
  toolNames: string[];
  totalCost: number | null;
  totalTokens: number;
  traceCount: number;
  traceIds: string[];
  user: ConversationUser | null;
}

interface ConversationApiResponse extends Omit<
  Conversation,
  'firstInput' | 'lastOutput'
> {
  firstInput?: Array<{text: string; type: string}> | string | null;
  lastOutput?: Array<{text: string; type: string}> | string | null;
}

const CONVERSATION_LIST_PER_PAGE = 50;

export const CONVERSATION_FIELDS = {
  age: {
    key: 'conversation.age',
    valueType: FieldValueType.DATE,
    description: t("Time of the conversation's latest span."),
    sortable: true,
  },
  duration: {
    key: 'conversation.duration',
    valueType: FieldValueType.DURATION,
    description: t('Combined duration of all AI spans.'),
  },
  generationDuration: {
    key: 'conversation.generationDuration',
    valueType: FieldValueType.DURATION,
    description: t('Combined duration of all LLM calls.'),
    sortable: true,
  },
  errors: {
    key: 'conversation.errors',
    valueType: FieldValueType.INTEGER,
    description: t('Number of failed spans.'),
    sortable: true,
  },
  messages: {
    key: 'conversation.messages',
    valueType: FieldValueType.INTEGER,
    description: t('Number of LLM calls.'),
    sortable: true,
  },
  toolCalls: {
    key: 'conversation.toolCalls',
    valueType: FieldValueType.INTEGER,
    description: t('Number of tool calls.'),
  },
  totalTokens: {
    key: 'conversation.totalTokens',
    valueType: FieldValueType.INTEGER,
    description: t('Total tokens used by LLM calls.'),
  },
  inputTokens: {
    key: 'conversation.inputTokens',
    valueType: FieldValueType.INTEGER,
    description: t('Input tokens used by LLM calls.'),
  },
  outputTokens: {
    key: 'conversation.outputTokens',
    valueType: FieldValueType.INTEGER,
    description: t('Output tokens used by LLM calls.'),
  },
  totalCost: {
    key: 'conversation.totalCost',
    valueType: FieldValueType.CURRENCY,
    description: t('Total cost of LLM calls.'),
    sortable: true,
  },
  toolErrors: {
    key: 'conversation.toolErrors',
    valueType: FieldValueType.INTEGER,
    description: t('Number of failed tool calls.'),
  },
} as const;

type ConversationField = (typeof CONVERSATION_FIELDS)[keyof typeof CONVERSATION_FIELDS];
type SortableConversationField = Extract<ConversationField, {sortable: true}>;
export type ConversationSortField = SortableConversationField['key'];

const CONVERSATION_SORT_FIELDS = Object.values(CONVERSATION_FIELDS)
  .filter((field): field is SortableConversationField => 'sortable' in field)
  .map(field => field.key);

const CONVERSATION_SORTS = CONVERSATION_SORT_FIELDS.flatMap(field => [
  field,
  `-${field}`,
]);

function normalizeConversationPreview(
  content: ConversationApiResponse['firstInput']
): string | null {
  return typeof content === 'string'
    ? content
    : (content?.find(part => part.type === 'text')?.text ?? null);
}

export function useConversations() {
  const organization = useOrganization();
  const {cursor, setCursor, unsetCursor} = useTableCursor();
  const pageFilters = usePageFilters();
  const combinedQuery = useCombinedQuery();
  const sortingEnabled = organization.features.includes(
    'gen-ai-conversations-querying-enhancements'
  );
  const [sort, setSort] = useQueryState(
    'sort',
    parseAsStringLiteral(CONVERSATION_SORTS).withDefault(
      `-${CONVERSATION_FIELDS.age.key}`
    )
  );

  const {
    data: response,
    isFetching,
    error,
  } = useQuery({
    ...apiOptions.as<ConversationApiResponse[]>()(
      '/organizations/$organizationIdOrSlug/agents/conversations/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: {
          cursor,
          query: combinedQuery,
          project: pageFilters.selection.projects,
          environment: pageFilters.selection.environments,
          per_page: CONVERSATION_LIST_PER_PAGE,
          sort: sortingEnabled ? [sort] : undefined,
          ...normalizeDateTimeParams(pageFilters.selection.datetime),
        },
        staleTime: 0,
      }
    ),
    select: selectJsonWithHeaders,
  });

  const pageLinks = response?.headers.Link;
  const isDirectHit = response?.headers['X-Sentry-Direct-Hit'] === '1';

  const data = useMemo(() => {
    return (response?.json ?? []).map(
      ({firstInput: rawFirstInput, lastOutput: rawLastOutput, ...rest}): Conversation => {
        const firstInput = normalizeConversationPreview(rawFirstInput);
        const lastOutput = normalizeConversationPreview(rawLastOutput);
        return {...rest, firstInput, lastOutput};
      }
    );
  }, [response?.json]);

  return {
    data,
    isFetching,
    error,
    pageLinks,
    setCursor,
    unsetCursor,
    isDirectHit,
    sort,
    setSort,
    sortingEnabled,
  };
}
