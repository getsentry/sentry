import {Stack} from '@sentry/scraps/layout';
import {TabList, Tabs} from '@sentry/scraps/tabs';

import {t} from 'sentry/locale';
import {ConversationsTable} from 'sentry/views/explore/conversations/components/conversationsTable';
import type {useConversations} from 'sentry/views/explore/conversations/hooks/useConversations';
import {ConversationOnboarding} from 'sentry/views/explore/conversations/onboarding';
import {useExploreSpansTable} from 'sentry/views/explore/hooks/useExploreSpansTable';
import {Tab} from 'sentry/views/explore/hooks/useTab';
import type {ReadableQueryParamsOptions} from 'sentry/views/explore/queryParams/readableQueryParams';
import {SPANS_TABLE_LIMIT} from 'sentry/views/explore/spans/constants';
import {useValidatedSpansTabColumns} from 'sentry/views/explore/spans/hooks/useValidatedSpansTabColumns';
import {SpansQueryParamsProvider} from 'sentry/views/explore/spans/spansQueryParamsProvider';
import {SpansTable} from 'sentry/views/explore/tables/spansTable';
import {TracesTable} from 'sentry/views/insights/pages/agents/components/tracesTable';
import {useCombinedQuery} from 'sentry/views/insights/pages/agents/hooks/useCombinedQuery';
import {SpanFields} from 'sentry/views/insights/types';

export const AGENTS_TABLE_TABS = ['conversations', 'traces', 'spans'] as const;
export type AgentsTableTab = (typeof AGENTS_TABLE_TABS)[number];

const TRACES_TABLE_LIMIT = 20;
export const LLM_CALLS_SAVED_QUERY = {
  fields: [
    SpanFields.ID,
    SpanFields.GEN_AI_OUTPUT_MESSAGES,
    SpanFields.GEN_AI_RESPONSE_MODEL,
    SpanFields.GEN_AI_COST_TOTAL_TOKENS,
    SpanFields.TIMESTAMP,
  ],
  query: `${SpanFields.GEN_AI_OPERATION_TYPE}:ai_client has:${SpanFields.GEN_AI_OUTPUT_MESSAGES}`,
} satisfies Pick<ReadableQueryParamsOptions, 'fields' | 'query'>;

interface AgentsTableProps {
  activeTab: AgentsTableTab;
  conversations: ReturnType<typeof useConversations>;
  hasAgenticSpans: boolean;
  hasConversations: boolean;
  onConversationOnboardingDismiss: () => void;
  onTabChange: (tab: AgentsTableTab) => void;
  searchBar?: React.ReactNode;
}

export function AgentsTable({
  activeTab,
  conversations,
  hasAgenticSpans,
  hasConversations,
  onConversationOnboardingDismiss,
  onTabChange,
  searchBar,
}: AgentsTableProps) {
  if (!hasAgenticSpans) {
    return <ConversationOnboarding onDismiss={onConversationOnboardingDismiss} />;
  }

  return (
    <Stack gap="md">
      <Tabs value={activeTab} onChange={onTabChange} size="sm">
        <TabList variant="floating">
          <TabList.Item key="conversations">{t('Conversations')}</TabList.Item>
          <TabList.Item key="traces">{t('Traces')}</TabList.Item>
          <TabList.Item key="spans">{t('LLM Calls')}</TabList.Item>
        </TabList>
      </Tabs>
      {searchBar}
      {activeTab === 'conversations' &&
        (hasConversations ? (
          <ConversationsTable conversations={conversations} />
        ) : (
          <ConversationOnboarding onDismiss={onConversationOnboardingDismiss} />
        ))}
      {activeTab === 'traces' && (
        <TracesTable agentFilterMode="page-agent" limit={TRACES_TABLE_LIMIT} />
      )}
      {activeTab === 'spans' && <AgentsSpansTable />}
    </Stack>
  );
}

function AgentsSpansTable() {
  return (
    <SpansQueryParamsProvider fields={LLM_CALLS_SAVED_QUERY.fields}>
      <AgentsSpansTableContent />
    </SpansQueryParamsProvider>
  );
}

function AgentsSpansTableContent() {
  const query = useCombinedQuery(LLM_CALLS_SAVED_QUERY.query);
  const spansTableResult = useExploreSpansTable({
    query,
    limit: SPANS_TABLE_LIMIT,
    enabled: true,
  });
  const {
    attributes: {boolean: booleanTags, number: numberTags, string: stringTags},
    fieldTypes: validatedFieldTypes,
  } = useValidatedSpansTabColumns(Tab.SPAN);

  return (
    <SpansTable
      booleanTags={booleanTags}
      numberTags={numberTags}
      spansTableResult={spansTableResult}
      stringTags={stringTags}
      validatedFieldTypes={validatedFieldTypes}
    />
  );
}
