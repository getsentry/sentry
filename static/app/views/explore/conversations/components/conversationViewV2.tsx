import {memo, useCallback, useEffect, useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {Button} from '@sentry/scraps/button';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {TabList, TabPanels, Tabs} from '@sentry/scraps/tabs';
import {Text} from '@sentry/scraps/text';

import {CopyAsDropdown} from 'sentry/components/copyAsDropdown';
import {EmptyMessage} from 'sentry/components/emptyMessage';
import {Placeholder} from 'sentry/components/placeholder';
import {SearchBar} from 'sentry/components/searchBar';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getDuration} from 'sentry/utils/duration/getDuration';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {AttributesTree} from 'sentry/views/explore/components/traceItemAttributes/attributesTree';
import {ConversationTranscript} from 'sentry/views/explore/conversations/components/conversationTranscript';
import {
  useConversation,
  type UseConversationsOptions,
} from 'sentry/views/explore/conversations/hooks/useConversation';
import {useConversationSelection} from 'sentry/views/explore/conversations/hooks/useConversationSelection';
import {
  extractMessagesFromNodes,
  messagesToMarkdown,
} from 'sentry/views/explore/conversations/utils/conversationMessages';
import type {TraceItemResponseAttribute} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {AISpanList} from 'sentry/views/insights/pages/agents/components/aiSpanList';
import {
  getNumberAttr,
  getStringAttr,
  getTraceNodeAttribute,
  resolveAgentName,
} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';
import {AIContentRenderer} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/span/eapSections/aiContentRenderer';
import {DEFAULT_TRACE_VIEW_PREFERENCES} from 'sentry/views/performance/newTraceDetails/traceState/tracePreferences';
import {TraceStateProvider} from 'sentry/views/performance/newTraceDetails/traceState/traceStateProvider';

interface ConversationViewV2ContentProps {
  conversation: UseConversationsOptions;
  focusedTool?: string | null;
  onSelectSpan?: (spanId: string) => void;
  selectedSpanId?: string | null;
}

export const ConversationViewV2Content = memo(function ConversationViewV2Content({
  conversation,
  selectedSpanId,
  onSelectSpan,
  focusedTool,
}: ConversationViewV2ContentProps) {
  const {nodes, isLoading, error} = useConversation(conversation);
  const {selectedNode, handleSelectNode} = useConversationSelection({
    nodes,
    selectedSpanId,
    onSelectSpan,
    focusedTool,
    isLoading,
  });

  return (
    <TraceStateProvider initialPreferences={DEFAULT_TRACE_VIEW_PREFERENCES}>
      <ConversationViewV2
        nodes={nodes}
        selectedNode={selectedNode}
        onSelectNode={handleSelectNode}
        isLoading={isLoading}
        error={error}
      />
    </TraceStateProvider>
  );
});

function ConversationViewV2({
  nodes,
  selectedNode,
  onSelectNode,
  isLoading,
  error,
}: {
  error: boolean;
  isLoading: boolean;
  nodes: AITraceSpanNode[];
  onSelectNode: (node: AITraceSpanNode) => void;
  selectedNode: AITraceSpanNode | undefined;
}) {
  const organization = useOrganization();
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !error && nodes.length === 0) {
      Sentry.captureMessage('User landed on empty conversation detail page (v2)', {
        level: 'warning',
      });
    }
  }, [isLoading, error, nodes.length]);

  const handleSelectNodeWithPanel = useCallback(
    (node: AITraceSpanNode) => {
      setShowDetailPanel(true);
      onSelectNode(node);
    },
    [onSelectNode]
  );

  const messages = useMemo(() => extractMessagesFromNodes(nodes), [nodes]);

  if (isLoading) {
    return <ConversationViewV2Skeleton />;
  }

  if (error) {
    return <EmptyMessage>{t('Failed to load conversation')}</EmptyMessage>;
  }

  if (nodes.length === 0) {
    return <EmptyMessage>{t('No AI spans found in this conversation')}</EmptyMessage>;
  }

  return (
    <ViewWrapper>
      <TwoCardLayout>
        <LeftCard>
          {messages.length > 0 && (
            <Flex
              flexShrink={0}
              align="center"
              justify="end"
              padding="xs sm"
              borderBottom="primary"
            >
              <CopyAsDropdown
                size="xs"
                items={CopyAsDropdown.makeDefaultCopyAsOptions({
                  markdown: () => {
                    trackAnalytics('conversations.detail.copy-conversation', {
                      organization,
                    });
                    return messagesToMarkdown(messages);
                  },
                  text: undefined,
                  json: undefined,
                })}
              />
            </Flex>
          )}
          <ChatContent>
            <ConversationTranscript
              nodes={nodes}
              selectedNodeId={selectedNode?.id ?? null}
              hoveredNodeId={hoveredNodeId}
              onSelectNode={handleSelectNodeWithPanel}
              onHoverNode={setHoveredNodeId}
              showToolCalls
            />
          </ChatContent>
        </LeftCard>

        <RightCard>
          <Container padding="md lg md lg" width="100%">
            <AISpanList
              nodes={nodes}
              selectedNodeKey={selectedNode?.id ?? ''}
              hoveredNodeKey={hoveredNodeId}
              onSelectNode={handleSelectNodeWithPanel}
              onHoverNode={setHoveredNodeId}
              compressGaps
            />
          </Container>
        </RightCard>
      </TwoCardLayout>

      {showDetailPanel && selectedNode && (
        <BottomCard>
          <SpanDetailPanel
            node={selectedNode}
            onClose={() => setShowDetailPanel(false)}
          />
        </BottomCard>
      )}
    </ViewWrapper>
  );
}

function ConversationViewV2Skeleton() {
  return (
    <ViewWrapper>
      <TwoCardLayout>
        <LeftCard>
          <ChatContent>
            <Flex direction="column" flex="1" gap="xl" padding="xl" align="end">
              <Placeholder height="32px" width="60%" />
              <Flex direction="column" gap="md" width="100%">
                <Placeholder height="14px" width="200px" />
                <Placeholder height="14px" width="300px" />
                <Placeholder height="14px" width="250px" />
              </Flex>
              <Placeholder height="80px" width="100%" />
              <Placeholder height="32px" width="40%" />
              <Flex direction="column" gap="md" width="100%">
                <Placeholder height="14px" width="180px" />
              </Flex>
              <Placeholder height="60px" width="100%" />
            </Flex>
          </ChatContent>
        </LeftCard>
        <RightCard>
          <Flex direction="column" gap="md" padding="lg">
            <Placeholder height="14px" width="180px" />
            <Placeholder height="14px" width="140px" />
            <Placeholder height="14px" width="160px" />
            <Placeholder height="14px" width="120px" />
          </Flex>
        </RightCard>
      </TwoCardLayout>
    </ViewWrapper>
  );
}

function getSpanDuration(node: AITraceSpanNode): number | undefined {
  const start =
    'start_timestamp' in node.value ? (node.value.start_timestamp as number) : 0;
  const end = 'end_timestamp' in node.value ? (node.value.end_timestamp as number) : 0;
  if (end > start) {
    return end - start;
  }
  return undefined;
}

function formatTokenCount(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return count.toString();
}

const INPUT_ATTRIBUTES = [
  'gen_ai.input.messages',
  'gen_ai.request.messages',
  'ai.input_messages',
  'ai.prompt',
  'gen_ai.system_instructions',
  'gen_ai.tool.call.arguments',
  'gen_ai.tool.input',
  'gen_ai.embeddings.input',
] as const;

const OUTPUT_ATTRIBUTES = [
  'gen_ai.output.messages',
  'gen_ai.response.text',
  'gen_ai.response.object',
  'gen_ai.response.tool_calls',
  'gen_ai.tool.call.result',
  'gen_ai.tool.output',
] as const;

function getRawContent(
  node: AITraceSpanNode,
  attributes: readonly string[]
): string | undefined {
  for (const key of attributes) {
    const val = getTraceNodeAttribute(key, node);
    if (val !== undefined && val !== null && val !== '') {
      return String(val);
    }
  }
  return undefined;
}

function SpanDetailPanel({node, onClose}: {node: AITraceSpanNode; onClose: () => void}) {
  const [activeTab, setActiveTab] = useState<string>('input');

  const rawOp = node.op ?? 'default';
  const description =
    node.description || ('name' in node.value ? (node.value.name as string) : rawOp);
  const duration = getSpanDuration(node);

  const agentName = resolveAgentName(node.attributes ?? {});
  const inputTokens = getNumberAttr(node, 'gen_ai.usage.input_tokens');
  const outputTokens = getNumberAttr(node, 'gen_ai.usage.output_tokens');
  const totalTokens = getNumberAttr(node, 'gen_ai.usage.total_tokens');
  const cost = getNumberAttr(node, 'ai.total_cost');
  const model = getStringAttr(node, 'gen_ai.request.model');

  const tokenDisplay = totalTokens
    ? formatTokenCount(totalTokens)
    : inputTokens !== undefined || outputTokens !== undefined
      ? formatTokenCount((inputTokens ?? 0) + (outputTokens ?? 0))
      : undefined;

  const inputContent = getRawContent(node, INPUT_ATTRIBUTES);
  const outputContent = getRawContent(node, OUTPUT_ATTRIBUTES);

  return (
    <PanelWrapper>
      <Flex justify="between" align="start" padding="xl" gap="md" flexShrink={0}>
        <Flex direction="column" gap="md" flex="1" minWidth="0">
          <Flex align="center" gap="md">
            <SpanColorDot />
            <Text size="md" bold>
              {description}
            </Text>
          </Flex>
          {duration !== undefined && (
            <Text size="md">{getDuration(duration, 2, true)}</Text>
          )}
          <MetadataGrid>
            {agentName && <MetadataRow label={t('Agent Name')} value={agentName} />}
            {tokenDisplay && <MetadataRow label={t('Tokens')} value={tokenDisplay} />}
            {cost !== undefined && (
              <MetadataRow label={t('Spend')} value={`$${cost.toFixed(2)}`} />
            )}
            {model && <MetadataRow label={t('Model')} value={model} />}
          </MetadataGrid>
        </Flex>
        <Button
          size="zero"
          variant="transparent"
          aria-label={t('Close detail panel')}
          icon={<IconClose size="xs" />}
          onClick={onClose}
        />
      </Flex>

      <TabsWrapper>
        <StyledTabs value={activeTab} onChange={key => setActiveTab(String(key))}>
          <StyledTabList>
            <TabList.Item key="input">{t('Input')}</TabList.Item>
            <TabList.Item key="output" hidden={!outputContent}>
              {t('Output')}
            </TabList.Item>
            <TabList.Item key="attributes">{t('Attributes')}</TabList.Item>
          </StyledTabList>
          <TabPanelsWrapper>
            <TabPanels.Item key="input">
              <TabContent>
                {inputContent ? (
                  <AIContentRenderer text={inputContent} />
                ) : (
                  <Text size="sm" variant="muted">
                    {t('No input data')}
                  </Text>
                )}
              </TabContent>
            </TabPanels.Item>
            <TabPanels.Item key="output">
              <TabContent>
                {outputContent ? (
                  <AIContentRenderer text={outputContent} />
                ) : (
                  <Text size="sm" variant="muted">
                    {t('No output data')}
                  </Text>
                )}
              </TabContent>
            </TabPanels.Item>
            <TabPanels.Item key="attributes">
              <TabContent>
                <SpanAttributes node={node} />
              </TabContent>
            </TabPanels.Item>
          </TabPanelsWrapper>
        </StyledTabs>
      </TabsWrapper>
    </PanelWrapper>
  );
}

function MetadataRow({label, value}: {label: string; value: string}) {
  return (
    <MetadataRowWrapper>
      <Text size="xs" variant="muted">
        {label}
      </Text>
      <Text size="xs">{value}</Text>
    </MetadataRowWrapper>
  );
}

function SpanAttributes({node}: {node: AITraceSpanNode}) {
  const [searchQuery, setSearchQuery] = useState('');
  const organization = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();

  const attributes: TraceItemResponseAttribute[] = useMemo(() => {
    const attrs = node.attributes ?? {};
    return Object.entries(attrs)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, value]) => {
        if (typeof value === 'number') {
          return Number.isInteger(value)
            ? {name, type: 'int' as const, value}
            : {name, type: 'float' as const, value};
        }
        if (typeof value === 'boolean') {
          return {name, type: 'bool' as const, value};
        }
        return {name, type: 'str' as const, value: String(value)};
      });
  }, [node.attributes]);

  const filteredAttributes = useMemo(() => {
    if (!searchQuery.trim()) {
      return attributes;
    }
    const q = searchQuery.toLowerCase().trim();
    return attributes.filter(a => a.name.toLowerCase().includes(q));
  }, [attributes, searchQuery]);

  return (
    <Stack gap="md">
      <SearchBar
        query={searchQuery}
        onChange={setSearchQuery}
        placeholder={t('Search')}
      />
      <AttributesTree
        attributes={filteredAttributes}
        rendererExtra={{organization, location, navigate, theme}}
        columnCount={1}
      />
    </Stack>
  );
}

const PanelWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
`;

const SpanColorDot = styled('div')`
  width: 16px;
  height: 16px;
  border-radius: 2px;
  flex-shrink: 0;
  background: ${p => p.theme.tokens.background.accent.vibrant};
`;

const MetadataGrid = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.md};
`;

const MetadataRowWrapper = styled('div')`
  display: grid;
  grid-template-columns: 80px 1fr;
  gap: ${p => p.theme.space.xs};
  align-items: baseline;
`;

const TabsWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: 0 ${p => p.theme.space.xl} ${p => p.theme.space.xl};
`;

const StyledTabs = styled(Tabs)`
  flex: 1;
  min-height: 0;
  overflow: hidden;
` as typeof Tabs;

const StyledTabList = styled(TabList)`
  flex-shrink: 0;
`;

const TabPanelsWrapper = styled(TabPanels)`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;

  > [role='tabpanel'] {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }
`;

const TabContent = styled('div')`
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  padding: ${p => p.theme.space.xl};
  background: ${p => p.theme.tokens.background.secondary};
  border-radius: ${p => p.theme.radius.md};
`;

const ViewWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  gap: ${p => p.theme.space.md};
`;

const TwoCardLayout = styled('div')`
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  gap: ${p => p.theme.space.md};
`;

const cardStyles = (p: {theme: any}) => `
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
  background: ${p.theme.tokens.background.primary};
  border: 1px solid ${p.theme.tokens.border.primary};
  border-radius: ${p.theme.radius.md};
`;

const LeftCard = styled('div')`
  ${cardStyles}
  flex: 1;
`;

const RightCard = styled('div')`
  ${cardStyles}
  width: 360px;
  flex-shrink: 0;
  overflow-y: auto;
`;

const BottomCard = styled('div')`
  ${cardStyles}
  flex: 0 0 auto;
  height: 45%;
`;

const ChatContent = styled('div')`
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
`;
