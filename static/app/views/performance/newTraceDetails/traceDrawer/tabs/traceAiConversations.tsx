import {type Key, useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {LinkButton} from '@sentry/scraps/button';
import {Container, Flex} from '@sentry/scraps/layout';
import {TabList, TabPanels, Tabs} from '@sentry/scraps/tabs';

import {EmptyMessage} from 'sentry/components/emptyMessage';
import {t} from 'sentry/locale';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  ConversationDetailPanel,
  ConversationLeftPanel,
  ConversationSplitLayout,
  ConversationViewSkeleton,
} from 'sentry/views/explore/conversations/components/conversationLayout';
import {
  ConversationSpanDetail,
  type DetailTab,
} from 'sentry/views/explore/conversations/components/conversationSpanDetail';
import {ConversationAggregatesBar} from 'sentry/views/explore/conversations/components/conversationSummary';
import {MessagesPanel} from 'sentry/views/explore/conversations/components/messagesPanel';
import {
  MessagesPanelNew,
  MessagesPanelSkeleton,
} from 'sentry/views/explore/conversations/components/messagesPanelNew';
import {useConversation} from 'sentry/views/explore/conversations/hooks/useConversation';
import {useConversationSelection} from 'sentry/views/explore/conversations/hooks/useConversationSelection';
import {CONVERSATIONS_LANDING_SUB_PATH} from 'sentry/views/explore/conversations/settings';
import {hasGenAiConversationsRedesignFeature} from 'sentry/views/explore/conversations/utils/features';
import {getTimeBoundsFromNodes} from 'sentry/views/explore/conversations/utils/timeBounds';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';
import {AiSpansSplitView} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceAiSpans';
import {DEFAULT_TRACE_VIEW_PREFERENCES} from 'sentry/views/performance/newTraceDetails/traceState/tracePreferences';
import {TraceStateProvider} from 'sentry/views/performance/newTraceDetails/traceState/traceStateProvider';

interface TraceAiConversationsProps {
  allAiNodes: AITraceSpanNode[];
  conversationIds: string[];
  traceSlug: string;
}

export function TraceAiConversations({
  conversationIds,
  allAiNodes,
  traceSlug,
}: TraceAiConversationsProps) {
  const organization = useOrganization();
  const hasRedesign = hasGenAiConversationsRedesignFeature(organization);
  // The redesign leads with the transcript, so default to the first
  // conversation tab instead of the Timeline/Spans tab.
  const [activeSubTab, setActiveSubTab] = useState(() =>
    hasRedesign && conversationIds.length > 0 ? `chat-${conversationIds[0]}` : 'spans'
  );
  const [selectedSpanId, setSelectedSpanId] = useState<string | null>(null);

  const handleTabChange = useCallback((key: Key) => {
    setActiveSubTab(String(key));
    setSelectedSpanId(null);
  }, []);

  const handleSelectSpan = useCallback((spanId: string) => {
    setSelectedSpanId(spanId);
  }, []);

  const activeConversationId = activeSubTab.startsWith('chat-')
    ? activeSubTab.slice('chat-'.length)
    : null;

  const traceTimeBounds = useMemo(() => getTimeBoundsFromNodes(allAiNodes), [allAiNodes]);

  const {
    nodes: conversationNodes,
    nodeTraceMap,
    isLoading,
    error,
  } = useConversation({
    conversationId: activeConversationId ?? '',
    ...traceTimeBounds,
  });

  const traceNodes = useMemo(
    () => conversationNodes.filter(n => nodeTraceMap.get(n.id) === traceSlug),
    [conversationNodes, nodeTraceMap, traceSlug]
  );

  const tabItems = useMemo((): Array<{
    conversationId: string | null;
    key: string;
    label: string;
  }> => {
    const spansTab = {
      key: 'spans',
      label: hasRedesign ? t('Timeline') : t('Spans'),
      conversationId: null,
    };
    const conversationTabs = conversationIds.map(id => ({
      key: `chat-${id}`,
      label: hasRedesign
        ? conversationIds.length === 1
          ? t('Transcript')
          : t('Transcript %s', id.slice(0, 8))
        : conversationIds.length === 1
          ? t('Chat')
          : t('Chat %s', id.slice(0, 8)),
      conversationId: id,
    }));

    // The redesign leads with the transcript(s), then the timeline.
    return hasRedesign
      ? [...conversationTabs, spansTab]
      : [spansTab, ...conversationTabs];
  }, [conversationIds, hasRedesign]);

  const linkConversationId = activeConversationId ?? conversationIds[0] ?? null;
  const conversationUrl = linkConversationId
    ? normalizeUrl(
        `/organizations/${organization.slug}/explore/${CONVERSATIONS_LANDING_SUB_PATH}/${linkConversationId}/${selectedSpanId && activeConversationId ? `?spanId=${encodeURIComponent(selectedSpanId)}` : ''}`
      )
    : null;

  return (
    <Container flex="1" minHeight="0" border="primary" radius="md" overflow="hidden">
      <Flex direction="column" height="100%">
        {activeConversationId && (
          <TraceConversationHeader
            conversationId={activeConversationId}
            nodes={traceNodes}
            isLoading={isLoading}
          />
        )}
        <StyledTabs value={activeSubTab} onChange={handleTabChange}>
          <Flex direction="row" justify="between" align="center" borderBottom="primary">
            <Container width="100%" minWidth="0">
              <TabList>
                {tabItems.map(item => (
                  <TabList.Item key={item.key}>{item.label}</TabList.Item>
                ))}
              </TabList>
            </Container>
            {conversationUrl && (
              <Flex flexShrink={0} padding="0 lg">
                <LinkButton size="xs" to={conversationUrl}>
                  {t('Show full conversation')}
                </LinkButton>
              </Flex>
            )}
          </Flex>
          <FullHeightTabPanels>
            {tabItems.map(item =>
              item.conversationId ? (
                <TabPanels.Item key={item.key}>
                  {hasRedesign ? (
                    <TraceConversationTranscript
                      nodes={traceNodes}
                      nodeTraceMap={nodeTraceMap}
                      isLoading={isLoading}
                      error={error}
                      selectedSpanId={selectedSpanId}
                      onSelectSpan={handleSelectSpan}
                    />
                  ) : (
                    <TraceConversationChat
                      nodes={traceNodes}
                      nodeTraceMap={nodeTraceMap}
                      isLoading={isLoading}
                      error={error}
                      selectedSpanId={selectedSpanId}
                      onSelectSpan={handleSelectSpan}
                    />
                  )}
                </TabPanels.Item>
              ) : (
                <TabPanels.Item key={item.key}>
                  <AiSpansSplitView nodes={allAiNodes} traceSlug={traceSlug} />
                </TabPanels.Item>
              )
            )}
          </FullHeightTabPanels>
        </StyledTabs>
      </Flex>
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

function TraceConversationChat({
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
  });

  if (isLoading) {
    return <ConversationViewSkeleton />;
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
            <Flex flex="1" minHeight="0" width="100%" overflowX="hidden" overflowY="auto">
              <MessagesPanel
                nodes={nodes}
                selectedNodeId={selectedNode?.id ?? null}
                onSelectNode={handleSelectNode}
              />
            </Flex>
          </ConversationLeftPanel>
        }
        right={
          <ConversationDetailPanel
            selectedNode={selectedNode}
            nodeTraceMap={nodeTraceMap}
          />
        }
      />
    </TraceStateProvider>
  );
}

/**
 * Redesigned transcript for the trace AI tab, gated behind
 * `gen-ai-conversations-redesign`. Mirrors `ConversationViewContentNew`: the
 * Seer Explorer-styled transcript on the left and the redesigned span detail
 * panel on the right, opened only when the user selects a span.
 */
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
    // The redesign opens the span detail only when the user selects a span.
    autoSelectDefaultNode: false,
  });

  const [detailState, setDetailState] = useState<{open: boolean; tab: DetailTab}>({
    open: true,
    tab: 'input',
  });

  const handleSelectAndOpenDetail = useCallback(
    (node: AITraceSpanNode) => {
      setDetailState(prev => ({...prev, open: true}));
      handleSelectNode(node);
    },
    [handleSelectNode]
  );

  if (error) {
    return <EmptyMessage>{t('Failed to load conversation')}</EmptyMessage>;
  }

  if (!isLoading && nodes.length === 0) {
    return (
      <EmptyMessage>
        {t('No chat messages in this portion of the conversation')}
      </EmptyMessage>
    );
  }

  return (
    <TraceStateProvider initialPreferences={DEFAULT_TRACE_VIEW_PREFERENCES}>
      <Flex flex="1" minWidth="0" minHeight="0" overflow="hidden">
        <ConversationLeftPanel>
          <Container
            containerType="inline-size"
            flex="1"
            minHeight="0"
            width="100%"
            background="secondary"
          >
            <Flex
              direction={{xs: 'column', md: 'row'}}
              height="100%"
              width="100%"
              gap="md"
              padding="md"
              minHeight="0"
              overflowY="auto"
              overflowX="hidden"
            >
              <Container
                flex="1"
                minWidth="0"
                minHeight={{xs: '320px', md: '0'}}
                background="primary"
                border="primary"
                radius="md"
                overflowX="hidden"
                overflowY="auto"
              >
                {isLoading ? (
                  <MessagesPanelSkeleton />
                ) : (
                  <MessagesPanelNew
                    nodes={nodes}
                    selectedNodeId={selectedNode?.id ?? null}
                    onSelectNode={handleSelectAndOpenDetail}
                    nodeTraceMap={nodeTraceMap}
                  />
                )}
              </Container>
              {detailState.open && selectedNode ? (
                <Flex
                  width={{xs: '100%', md: '430px'}}
                  flex={{xs: '1', md: '0 0 auto'}}
                  minHeight={{xs: '320px', md: '0'}}
                >
                  <ConversationSpanDetail
                    node={selectedNode}
                    traceId={nodeTraceMap.get(selectedNode.id) ?? ''}
                    activeTab={detailState.tab}
                    onTabChange={tab => setDetailState(prev => ({...prev, tab}))}
                    onClose={() => setDetailState(prev => ({...prev, open: false}))}
                  />
                </Flex>
              ) : null}
            </Flex>
          </Container>
        </ConversationLeftPanel>
      </Flex>
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
