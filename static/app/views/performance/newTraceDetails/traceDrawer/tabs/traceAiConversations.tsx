import {type Key, useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import {LinkButton} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {TabList, TabPanels, Tabs} from '@sentry/scraps/tabs';

import {EmptyMessage} from 'sentry/components/emptyMessage';
import {t} from 'sentry/locale';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  ConversationLeftPanel,
  ConversationSplitLayout,
} from 'sentry/views/explore/conversations/components/conversationLayout';
import {
  ConversationSpanDetail,
  type DetailTab,
} from 'sentry/views/explore/conversations/components/conversationSpanDetail';
import {ConversationAggregatesBar} from 'sentry/views/explore/conversations/components/conversationSummary';
import {
  MessagesPanel,
  MessagesPanelSkeleton,
} from 'sentry/views/explore/conversations/components/messagesPanel';
import {useConversation} from 'sentry/views/explore/conversations/hooks/useConversation';
import {useConversationSelection} from 'sentry/views/explore/conversations/hooks/useConversationSelection';
import {
  EXPLORE_AGENTS_SUB_PATH,
  CONVERSATIONS_DETAIL_SUB_PATH,
} from 'sentry/views/explore/conversations/settings';
import {getTimeBoundsFromNodes} from 'sentry/views/explore/conversations/utils/timeBounds';
import {getStringAttr} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';
import {SpanFields} from 'sentry/views/insights/types';
import {AiSpansSplitView} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceAiSpans';
import {DEFAULT_TRACE_VIEW_PREFERENCES} from 'sentry/views/performance/newTraceDetails/traceState/tracePreferences';
import {TraceStateProvider} from 'sentry/views/performance/newTraceDetails/traceState/traceStateProvider';

interface TraceAiConversationsProps {
  allAiNodes: AITraceSpanNode[];
  conversationIds: string[];
  traceSlug: string;
}

type SubTab = 'timeline' | 'transcript';

export function TraceAiConversations({
  conversationIds,
  allAiNodes,
  traceSlug,
}: TraceAiConversationsProps) {
  const organization = useOrganization();
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('transcript');
  const [selectedConversationId, setSelectedConversationId] = useState<string>(
    () => conversationIds[0] ?? ''
  );
  const [selectedSpanId, setSelectedSpanId] = useState<string | null>(null);

  // Fall back to the first conversation if the selection is stale (e.g. the
  // trace changed and no longer contains the previously selected conversation).
  const activeConversationId = conversationIds.includes(selectedConversationId)
    ? selectedConversationId
    : (conversationIds[0] ?? '');

  const handleTabChange = useCallback((key: Key) => {
    setActiveSubTab(String(key) as SubTab);
    setSelectedSpanId(null);
  }, []);

  const handleConversationChange = (id: string) => {
    setSelectedConversationId(id);
    setSelectedSpanId(null);
  };

  const handleSelectSpan = useCallback((spanId: string) => {
    setSelectedSpanId(spanId);
  }, []);

  const traceTimeBounds = useMemo(() => getTimeBoundsFromNodes(allAiNodes), [allAiNodes]);

  // The trace's AI spans scoped to the selected conversation, for the timeline.
  const selectedTraceAiNodes = useMemo(
    () =>
      allAiNodes.filter(
        node =>
          getStringAttr(node, SpanFields.GEN_AI_CONVERSATION_ID) === activeConversationId
      ),
    [allAiNodes, activeConversationId]
  );

  const {
    nodes: conversationNodes,
    nodeTraceMap,
    isLoading,
    error,
  } = useConversation({
    conversationId: activeConversationId,
    ...traceTimeBounds,
  });

  const traceNodes = useMemo(
    () => conversationNodes.filter(n => nodeTraceMap.get(n.id) === traceSlug),
    [conversationNodes, nodeTraceMap, traceSlug]
  );

  const conversationOptions = useMemo(
    () => conversationIds.map(id => ({value: id, label: id.slice(0, 8)})),
    [conversationIds]
  );

  const conversationUrl = activeConversationId
    ? normalizeUrl(
        `/organizations/${organization.slug}/explore/${EXPLORE_AGENTS_SUB_PATH}/${CONVERSATIONS_DETAIL_SUB_PATH}/${activeConversationId}/?${qs.stringify(
          {
            referrer: 'trace-view',
            ...(selectedSpanId && activeSubTab === 'transcript'
              ? {spanId: selectedSpanId}
              : {}),
          }
        )}`
      )
    : null;

  return (
    <Container flex="1" minHeight="0" border="primary" radius="md" overflow="hidden">
      <Stack height="100%">
        <StyledTabs value={activeSubTab} onChange={handleTabChange}>
          <Flex
            direction="row"
            justify="between"
            align="center"
            gap="md"
            padding="0 lg"
            borderBottom="primary"
          >
            <Flex align="center" gap="md" minWidth="0" flex="1">
              {conversationIds.length > 1 && (
                <CompactSelect
                  size="xs"
                  value={activeConversationId}
                  options={conversationOptions}
                  onChange={option => handleConversationChange(option.value)}
                  trigger={triggerProps => (
                    <OverlayTrigger.Button
                      {...triggerProps}
                      size="xs"
                      prefix={t('Conversation')}
                    />
                  )}
                />
              )}
              <TabList outerWrapStyles={{flex: 1}}>
                <TabList.Item key="transcript">{t('Transcript')}</TabList.Item>
                <TabList.Item key="timeline">{t('Timeline')}</TabList.Item>
              </TabList>
            </Flex>
            {conversationUrl && (
              <LinkButton size="xs" to={conversationUrl}>
                {t('Show full conversation')}
              </LinkButton>
            )}
          </Flex>
          {activeConversationId && (
            <TraceConversationHeader
              conversationId={activeConversationId}
              nodes={traceNodes}
              isLoading={isLoading}
            />
          )}
          <FullHeightTabPanels>
            <TabPanels.Item key="transcript">
              <TraceConversationTranscript
                nodes={traceNodes}
                nodeTraceMap={nodeTraceMap}
                isLoading={isLoading}
                error={error}
                selectedSpanId={selectedSpanId}
                onSelectSpan={handleSelectSpan}
              />
            </TabPanels.Item>
            <TabPanels.Item key="timeline">
              <AiSpansSplitView nodes={selectedTraceAiNodes} traceSlug={traceSlug} />
            </TabPanels.Item>
          </FullHeightTabPanels>
        </StyledTabs>
      </Stack>
    </Container>
  );
}

function TraceConversationHeader({
  conversationId,
  nodes,
  isLoading,
}: {
  conversationId: string;
  isLoading: boolean;
  nodes: AITraceSpanNode[];
}) {
  return (
    <Container padding="md lg" borderBottom="primary">
      <ConversationAggregatesBar
        nodes={nodes}
        conversationId={conversationId}
        isLoading={isLoading}
      />
    </Container>
  );
}

function TraceConversationTranscript({
  nodes,
  nodeTraceMap,
  isLoading,
  error,
  selectedSpanId,
  onSelectSpan,
}: {
  error: boolean;
  isLoading: boolean;
  nodeTraceMap: Map<string, string>;
  nodes: AITraceSpanNode[];
  onSelectSpan: (spanId: string) => void;
  selectedSpanId: string | null;
}) {
  const {selectedNode, handleSelectNode} = useConversationSelection({
    nodes,
    selectedSpanId,
    onSelectSpan,
    isLoading,
    autoSelectDefaultNode: false,
  });

  const [detailTab, setDetailTab] = useState<DetailTab>('input');

  if (isLoading) {
    return <MessagesPanelSkeleton />;
  }

  if (error) {
    return <EmptyMessage>{t('Failed to load conversation')}</EmptyMessage>;
  }

  if (nodes.length === 0) {
    return (
      <EmptyMessage>
        {t('No chat messages in this portion of the conversation')}
      </EmptyMessage>
    );
  }

  return (
    <TraceStateProvider initialPreferences={DEFAULT_TRACE_VIEW_PREFERENCES}>
      <ConversationSplitLayout
        sizeStorageKey="trace-conversation-split-size"
        left={
          <ConversationLeftPanel>
            <Flex flex="1" minHeight="0" overflowY="auto">
              <MessagesPanel
                nodes={nodes}
                selectedNodeId={selectedNode?.id ?? null}
                onSelectNode={handleSelectNode}
              />
            </Flex>
          </ConversationLeftPanel>
        }
        right={
          selectedNode ? (
            <ConversationSpanDetail
              node={selectedNode}
              traceId={nodeTraceMap.get(selectedNode.id) ?? ''}
              activeTab={detailTab}
              onTabChange={setDetailTab}
              embedded
            />
          ) : (
            <EmptyMessage>{t('Select a span to see its details')}</EmptyMessage>
          )
        }
      />
    </TraceStateProvider>
  );
}

const StyledTabs = styled(Tabs)`
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
`;

const FullHeightTabPanels = styled(TabPanels)`
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 0;

  > [role='tabpanel'] {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
`;
