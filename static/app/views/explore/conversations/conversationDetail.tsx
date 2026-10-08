import {useCallback, useEffect, useMemo, useState, type ReactNode} from 'react';
import {IconCopy} from '@sentry/icons/copy';
import {parseAsString, parseAsStringLiteral, useQueryStates} from 'nuqs';

import {Button} from '@sentry/scraps/button';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {TabList, Tabs} from '@sentry/scraps/tabs';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {parseAsUtcDateTime} from 'sentry/utils/url/parseAsUtcDateTime';
import {copyToClipboard} from 'sentry/utils/useCopyToClipboard';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useProjects} from 'sentry/utils/useProjects';
import {ViewportConstrainedPage} from 'sentry/views/explore/components/viewportConstrainedPage';
import {ConversationsBreadcrumbs} from 'sentry/views/explore/conversations/components/conversationsBreadcrumbs';
import {ConversationSummary} from 'sentry/views/explore/conversations/components/conversationSummary';
import {
  CONVERSATION_VIEW_TABS,
  ConversationViewContent,
} from 'sentry/views/explore/conversations/components/conversationView';
import {useConversation} from 'sentry/views/explore/conversations/hooks/useConversation';
import {
  extractMessagesFromNodes,
  messagesToMarkdown,
} from 'sentry/views/explore/conversations/utils/conversationMessages';

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
  const [isCopyingTranscript, setIsCopyingTranscript] = useState(false);

  const {stats, nodes, nodeTraceMap, isLoading, error, hasNextPage, title} =
    useConversation({...conversation, autoFetchAll: isCopyingTranscript});

  const messages = useMemo(() => extractMessagesFromNodes(nodes), [nodes]);
  const isInitialLoading = isLoading && nodes.length === 0;

  useEffect(() => {
    if (!isCopyingTranscript || isLoading) {
      return;
    }
    if (error) {
      addErrorMessage(t('Failed to load the complete transcript'));
    } else if (hasNextPage) {
      addErrorMessage(t('Transcript is too large to copy'));
    } else {
      void copyToClipboard(messagesToMarkdown(messages));
    }
    // oxlint-disable-next-line react/set-state-in-effect
    setIsCopyingTranscript(false);
  }, [error, hasNextPage, isCopyingTranscript, isLoading, messages]);

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

  const handleDeselectSpan = useCallback(() => {
    setQueryState({spanId: null, focusedTool: null});
  }, [setQueryState]);

  const handleViewTimeline = useCallback(() => {
    setQueryState({tab: 'timeline'});
  }, [setQueryState]);

  function handleCopyTranscript() {
    trackAnalytics('conversations.detail.copy-conversation', {
      organization,
    });
    if (hasNextPage) {
      setIsCopyingTranscript(true);
    } else {
      void copyToClipboard(messagesToMarkdown(messages));
    }
  }

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
          isLoading={isInitialLoading}
        />
      </Container>
      <Stack flex={1} minHeight="0" overflow="hidden" padding="xl" gap="xl">
        <Flex flexShrink={0} align="center" justify="between" gap="md">
          <Tabs value={queryState.tab} onChange={tab => setQueryState({tab})}>
            <TabList variant="floating">
              <TabList.Item key="transcript">{t('Transcript')}</TabList.Item>
              <TabList.Item key="timeline">{t('Timeline')}</TabList.Item>
            </TabList>
          </Tabs>
          {queryState.tab === 'transcript' &&
            !isInitialLoading &&
            messages.length > 0 && (
              <Button
                size="xs"
                icon={<IconCopy />}
                busy={isCopyingTranscript}
                onClick={handleCopyTranscript}
              >
                {t('Copy Transcript')}
              </Button>
            )}
        </Flex>
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
