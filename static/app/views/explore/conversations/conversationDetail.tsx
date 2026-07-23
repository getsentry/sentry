import {useCallback, useEffect, useMemo, type ReactNode} from 'react';
import {parseAsString, parseAsStringLiteral, useQueryStates} from 'nuqs';

import {Button} from '@sentry/scraps/button';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {TabList, Tabs} from '@sentry/scraps/tabs';

import {IconCopy} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
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
import {TopBar} from 'sentry/views/navigation/topBar';

function useConversationDetailQueryState() {
  return useQueryStates(
    {
      spanId: parseAsString,
      focusedTool: parseAsString,
      tab: parseAsStringLiteral(CONVERSATION_VIEW_TABS).withDefault('transcript'),
    },
    {history: 'replace'}
  );
}

function ConversationDetailPage() {
  const organization = useOrganization();
  const {conversationId} = useParams<{conversationId: string}>();
  const [queryState, setQueryState] = useConversationDetailQueryState();

  const conversation = useMemo(() => ({conversationId}), [conversationId]);

  const {nodes, nodeTraceMap, isLoading} = useConversation(conversation);

  const messages = useMemo(() => extractMessagesFromNodes(nodes), [nodes]);

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

  return (
    <ViewportConstrainedPage background="secondary">
      <TopBar.Slot name="title">
        <ConversationsBreadcrumbs conversationId={conversationId} project={project} />
      </TopBar.Slot>
      <Container flexShrink={0} background="primary" borderBottom="primary" padding="xl">
        <ConversationSummary
          nodes={nodes}
          nodeTraceMap={nodeTraceMap}
          conversationId={conversationId}
          isLoading={isLoading}
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
          {queryState.tab === 'transcript' && !isLoading && messages.length > 0 && (
            <Button
              size="xs"
              icon={<IconCopy />}
              onClick={() => {
                trackAnalytics('conversations.detail.copy-conversation', {
                  organization,
                });
                copyToClipboard(messagesToMarkdown(messages));
              }}
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
