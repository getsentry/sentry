import {useCallback, useEffect, useMemo, type ReactNode} from 'react';
import {parseAsString, parseAsStringLiteral, useQueryStates} from 'nuqs';

import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Tabs} from '@sentry/scraps/tabs';

import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {parseAsUtcDateTime} from 'sentry/utils/url/parseAsUtcDateTime';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useProjects} from 'sentry/utils/useProjects';
import {ViewportConstrainedPage} from 'sentry/views/explore/components/viewportConstrainedPage';

import {ConversationsBreadcrumbs} from './components/conversationsBreadcrumbs';
import {ConversationSearchInput} from './components/conversationSearchInput';
import {ConversationSummary} from './components/conversationSummary';
import {
  CONVERSATION_VIEW_TABS,
  ConversationViewContent,
  type ConversationViewTab,
} from './components/conversationView';
import {ExportTranscriptButton} from './components/exportTranscriptButton';
import {useConversation} from './hooks/useConversation';
import {useConversationSpanSearch} from './hooks/useConversationSpanSearch';
import {extractMessagesFromNodes} from './utils/conversationMessages';
import {hasConversationTranscriptSearchFeature} from './utils/features';

function useConversationDetailQueryState() {
  return useQueryStates(
    {
      spanId: parseAsString,
      focusedTool: parseAsString,
      start: parseAsUtcDateTime,
      end: parseAsUtcDateTime,
      tab: parseAsStringLiteral(CONVERSATION_VIEW_TABS).withDefault('transcript'),
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
  const {
    stats,
    nodes,
    nodeTraceMap,
    isLoading,
    hasNextPage,
    canAutoFetchNextPage,
    isFetchingNextPage,
    title,
  } = useConversation({
    ...conversation,
    autoFetchAll: false,
  });

  const messages = useMemo(() => extractMessagesFromNodes(nodes), [nodes]);
  const isInitialLoading = isLoading && nodes.length === 0;

  const projectSlug = useMemo(
    () => nodes.find(node => node.projectSlug)?.projectSlug,
    [nodes]
  );
  const {projects} = useProjects({slugs: projectSlug ? [projectSlug] : []});
  const project = projectSlug
    ? (projects.find(p => p.slug === projectSlug) ?? {slug: projectSlug})
    : undefined;

  useEffect(() => {
    trackAnalytics('conversations.detail.page-view', {
      organization,
    });
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
  }, [organization, conversationId]);

  const handleSelectSpan = useCallback(
    (spanId: string) => {
      setQueryState({spanId, focusedTool: null});
    },
    [setQueryState]
  );

  const spanSearch = useConversationSpanSearch({
    conversation,
    onMatch: handleSelectSpan,
  });

  // Spans the transcript can highlight. User messages and assistant turns without
  // text have no selectable block.
  const transcriptNodeIds = useMemo(
    () =>
      new Set(
        messages.flatMap(message => [
          ...(message.role === 'user' ||
          (message.role === 'assistant' && message.content === '')
            ? []
            : [message.nodeId]),
          ...(message.toolCalls ?? []).map(toolCall => toolCall.nodeId),
        ])
      ),
    [messages]
  );

  const getSearchStatus = (): string | null => {
    const {state} = spanSearch;
    switch (state.status) {
      case 'idle':
        return null;
      case 'searching':
        return t('Searching…');
      case 'no-match':
        return t('No results');
      case 'error':
        return t('Search failed');
      case 'match': {
        const spanId = state.spanIds[state.index];
        if (!nodes.some(node => node.id === spanId)) {
          return isLoading || canAutoFetchNextPage || isFetchingNextPage
            ? t('Loading match…')
            : t('Match is beyond the loaded spans');
        }
        if (queryState.tab === 'transcript' && !transcriptNodeIds.has(spanId!)) {
          return t('No transcript block, showing details');
        }
        return null;
      }
      default:
        return null;
    }
  };

  const handleDeselectSpan = useCallback(() => {
    setQueryState({spanId: null, focusedTool: null});
  }, [setQueryState]);

  const handleTabChange = useCallback(
    (tab: ConversationViewTab) => {
      if (tab !== queryState.tab) {
        trackAnalytics('conversations.detail.tab-switch', {
          organization,
          fromTab: queryState.tab,
          toTab: tab,
        });
      }
      setQueryState({tab});
    },
    [organization, queryState.tab, setQueryState]
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
          <Tabs value={queryState.tab} onChange={handleTabChange}>
            {({TabList}) => (
              <TabList variant="floating">
                <TabList.Item key="transcript">{t('Transcript')}</TabList.Item>
                <TabList.Item key="timeline">{t('Timeline')}</TabList.Item>
              </TabList>
            )}
          </Tabs>
          {queryState.tab === 'transcript' && messages.length > 0 && (
            <ExportTranscriptButton conversation={conversation} />
          )}
        </Flex>
        {hasConversationTranscriptSearchFeature(organization) && (
          <ConversationSearchInput
            onSubmit={spanSearch.submit}
            onClear={spanSearch.clear}
            onNext={spanSearch.next}
            onPrevious={spanSearch.previous}
            status={getSearchStatus()}
            counter={
              spanSearch.state.status === 'match'
                ? `${spanSearch.state.index + 1}/${spanSearch.state.total}`
                : null
            }
          />
        )}
        <ConversationViewContainer>
          <ConversationViewContent
            conversation={conversation}
            activeTab={queryState.tab}
            selectedSpanId={queryState.spanId}
            onSelectSpan={handleSelectSpan}
            onDeselectSpan={handleDeselectSpan}
            onViewTimeline={handleViewTimeline}
            focusedTool={queryState.focusedTool}
          />
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
