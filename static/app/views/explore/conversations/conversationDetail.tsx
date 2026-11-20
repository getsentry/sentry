import {useCallback, useEffect, useMemo, useState, type ReactNode} from 'react';
import {parseAsString, parseAsStringLiteral, useQueryStates} from 'nuqs';

import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Tabs} from '@sentry/scraps/tabs';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {Placeholder} from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {parseAsUtcDateTime} from 'sentry/utils/url/parseAsUtcDateTime';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useProjects} from 'sentry/utils/useProjects';
import {ViewportConstrainedPage} from 'sentry/views/explore/components/viewportConstrainedPage';

import {ConversationsBreadcrumbs} from './components/conversationsBreadcrumbs';
import {ConversationSummary} from './components/conversationSummary';
import {
  CONVERSATION_VIEW_TABS,
  ConversationViewContent,
  type ConversationViewTab,
} from './components/conversationView';
import {ExportTranscriptButton} from './components/exportTranscriptButton';
import {useConversation} from './hooks/useConversation';
import {
  extractMessagesFromNodes,
  hasCapturedMessageContent,
} from './utils/conversationMessages';

function useConversationDetailQueryState() {
  return useQueryStates(
    {
      spanId: parseAsString,
      focusedTool: parseAsString,
      start: parseAsUtcDateTime,
      end: parseAsUtcDateTime,
      tab: parseAsStringLiteral(CONVERSATION_VIEW_TABS),
    },
    {history: 'replace'}
  );
}

function ConversationDetailPage() {
  const organization = useOrganization();
  const {conversationId} = useParams<{conversationId: string}>();
  const [queryState, setQueryState] = useConversationDetailQueryState();

  // Read the time window from the URL rather than the page filters: on in-app
  // navigation from the list, the page filters still hold the list's selection
  // when the first request is made.
  const {start, end} = queryState;
  const startTimestamp = start?.getTime();
  const endTimestamp = end?.getTime();
  const conversation = useMemo(
    () => ({conversationId, startTimestamp, endTimestamp}),
    [conversationId, startTimestamp, endTimestamp]
  );
  const {stats, nodes, nodeTraceMap, isLoading, hasNextPage, title} = useConversation({
    ...conversation,
    autoFetchAll: false,
  });

  const messages = useMemo(() => extractMessagesFromNodes(nodes), [nodes]);
  const isInitialLoading = isLoading && nodes.length === 0;

  // Without an explicit tab, open the transcript only when the SDK captured
  // messages; otherwise it holds just placeholders and the timeline is more
  // useful. Decided once per conversation from its first page, so loading more
  // spans never switches the tab under the user.
  const [defaultTab, setDefaultTab] = useState<{
    conversationId: string;
    tab: ConversationViewTab;
  } | null>(null);
  if (!isInitialLoading && defaultTab?.conversationId !== conversationId) {
    setDefaultTab({
      conversationId,
      tab: hasCapturedMessageContent(messages) ? 'transcript' : 'timeline',
    });
  }
  // Until the first page decides the default, show neither tab, so an
  // uncaptured conversation doesn't flash the transcript before the timeline.
  const isDefaultTabPending =
    !queryState.tab && defaultTab?.conversationId !== conversationId;
  const activeTab: ConversationViewTab =
    queryState.tab ??
    (defaultTab?.conversationId === conversationId ? defaultTab.tab : 'transcript');

  const projectSlug = useMemo(
    () => nodes.find(node => node.projectSlug)?.projectSlug,
    [nodes]
  );
  const {projects} = useProjects({slugs: projectSlug ? [projectSlug] : []});
  const project = projectSlug
    ? (projects.find(p => p.slug === projectSlug) ?? {slug: projectSlug})
    : undefined;

  useEffect(() => {
    trackAnalytics('conversations.detail.page-view', {organization});
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
  }, [organization, conversationId]);

  const handleSelectSpan = useCallback(
    (spanId: string) => {
      setQueryState({spanId, focusedTool: null});
    },
    [setQueryState]
  );

  const handleDeselectSpan = useCallback(() => {
    setQueryState({spanId: null, focusedTool: null});
  }, [setQueryState]);

  const handleTabChange = useCallback(
    (tab: ConversationViewTab) => {
      if (tab !== activeTab) {
        trackAnalytics('conversations.detail.tab-switch', {
          organization,
          fromTab: activeTab,
          toTab: tab,
        });
      }
      setQueryState({tab});
    },
    [organization, activeTab, setQueryState]
  );

  const handleViewTimeline = useCallback(() => {
    handleTabChange('timeline');
  }, [handleTabChange]);

  return (
    <ViewportConstrainedPage background="secondary">
      <ConversationsBreadcrumbs conversationId={conversationId} />
      <Container flexShrink={0} background="primary" borderBottom="primary" padding="xl">
        <ConversationSummary
          stats={stats}
          nodes={nodes}
          nodeTraceMap={nodeTraceMap}
          conversationId={conversationId}
          title={title}
          project={project}
          hasMoreSpans={hasNextPage}
          isLoading={isInitialLoading}
        />
      </Container>
      <Stack flex={1} minHeight="0" overflow="hidden" padding="xl" gap="xl">
        <Flex flexShrink={0} align="center" justify="between" gap="md">
          {isDefaultTabPending ? (
            <Placeholder width="180px" height="32px" />
          ) : (
            <Tabs value={activeTab} onChange={handleTabChange}>
              {({TabList}) => (
                <TabList variant="floating">
                  <TabList.Item key="transcript">{t('Transcript')}</TabList.Item>
                  <TabList.Item key="timeline">{t('Timeline')}</TabList.Item>
                </TabList>
              )}
            </Tabs>
          )}
          {activeTab === 'transcript' && messages.length > 0 && (
            <ExportTranscriptButton conversation={conversation} />
          )}
        </Flex>
        <ConversationViewContainer>
          {isDefaultTabPending ? (
            <Flex flex={1} align="center" justify="center">
              <LoadingIndicator />
            </Flex>
          ) : (
            <ConversationViewContent
              conversation={conversation}
              messages={messages}
              activeTab={activeTab}
              selectedSpanId={queryState.spanId}
              onSelectSpan={handleSelectSpan}
              onDeselectSpan={handleDeselectSpan}
              onViewTimeline={handleViewTimeline}
              focusedTool={queryState.focusedTool}
            />
          )}
        </ConversationViewContainer>
      </Stack>
    </ViewportConstrainedPage>
  );
}

function ConversationViewContainer({children}: {children: ReactNode}) {
  return (
    <Container
      flex={1}
      minHeight="0"
      overflow="hidden"
      background="primary"
      display="flex"
    >
      {/*
       * No explicit `height: 100%` here: the parent Container is a flex row
       * with the default `align-items: stretch`, so this pane already fills the
       * available height. A `height: 100%` would resolve against the parent's
       * height, which is indefinite when the app is in its mobile (column)
       * layout — every browser then collapses this subtree to zero height,
       * leaving the conversation detail view blank. (TET-2690)
       */}
      <Flex flex={1} minWidth="0" minHeight="0">
        {children}
      </Flex>
    </Container>
  );
}

export default ConversationDetailPage;
