import {useCallback, useEffect, useMemo} from 'react';
import {parseAsString, parseAsStringLiteral, useQueryStates} from 'nuqs';

import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {TabList, Tabs} from '@sentry/scraps/tabs';

import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
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
        <Flex flexShrink={0}>
          <Tabs value={queryState.tab} onChange={tab => setQueryState({tab})}>
            <TabList variant="floating">
              <TabList.Item key="transcript">{t('Transcript')}</TabList.Item>
              <TabList.Item key="timeline">{t('Timeline')}</TabList.Item>
            </TabList>
          </Tabs>
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
