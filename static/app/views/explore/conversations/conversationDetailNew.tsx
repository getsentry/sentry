import {useCallback, useEffect, useMemo} from 'react';
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
import {ConversationSummaryNew} from 'sentry/views/explore/conversations/components/conversationSummaryNew';
import {
  CONVERSATION_VIEW_TABS,
  ConversationViewContentNew,
} from 'sentry/views/explore/conversations/components/conversationViewNew';
import {ConversationViewContainer} from 'sentry/views/explore/conversations/conversationDetail';
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

export function ConversationDetailPageNew() {
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
        <ConversationSummaryNew
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
          <ConversationViewContentNew
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
