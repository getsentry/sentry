import {useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Tag} from '@sentry/scraps/badge';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {ClippedBox} from 'sentry/components/clippedBox';
import {IconChat, IconChevron, IconFire, IconFix} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getDuration} from 'sentry/utils/duration/getDuration';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {
  ConversationMessage,
  ToolCall,
} from 'sentry/views/explore/conversations/utils/conversationMessages';
import {extractMessagesFromNodes} from 'sentry/views/explore/conversations/utils/conversationMessages';
import {getFirstToolInputValue} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';
import {AIContentRenderer} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/span/eapSections/aiContentRenderer';

const COLLAPSED_TOOL_THRESHOLD = 4;

function getNodeDuration(node: AITraceSpanNode): number | undefined {
  const start =
    'start_timestamp' in node.value ? (node.value.start_timestamp as number) : 0;
  const end = 'end_timestamp' in node.value ? (node.value.end_timestamp as number) : 0;
  if (end > start) {
    return end - start;
  }
  return undefined;
}

function formatDuration(seconds: number): string {
  return getDuration(seconds, 1, true);
}

interface ConversationTranscriptProps {
  nodes: AITraceSpanNode[];
  onSelectNode: (node: AITraceSpanNode) => void;
  selectedNodeId: string | null;
  hoveredNodeId?: string | null;
  onHoverNode?: (nodeId: string | null) => void;
  showToolCalls?: boolean;
}

export function ConversationTranscript({
  nodes,
  selectedNodeId,
  hoveredNodeId,
  onSelectNode,
  onHoverNode,
  showToolCalls = true,
}: ConversationTranscriptProps) {
  const organization = useOrganization();
  const messages = useMemo(() => extractMessagesFromNodes(nodes), [nodes]);

  const nodeMap = useMemo(() => {
    const map = new Map<string, AITraceSpanNode>();
    for (const node of nodes) {
      map.set(node.id, node);
    }
    return map;
  }, [nodes]);

  const handleMessageClick = useCallback(
    (message: ConversationMessage) => {
      trackAnalytics('conversations.message.click', {organization});
      const node = nodeMap.get(message.nodeId);
      if (node) {
        onSelectNode(node);
      }
    },
    [nodeMap, onSelectNode, organization]
  );

  const handleToolClick = useCallback(
    (tool: ToolCall) => {
      trackAnalytics('conversations.message.click-tool-call', {organization});
      const node = nodeMap.get(tool.nodeId);
      if (node) {
        onSelectNode(node);
      }
    },
    [nodeMap, onSelectNode, organization]
  );

  if (messages.length === 0) {
    return (
      <TranscriptRoot>
        <Text size="sm" variant="muted">
          {t('No messages found')}
        </Text>
      </TranscriptRoot>
    );
  }

  return (
    <TranscriptRoot>
      {messages.map(message => {
        if (message.role === 'user') {
          return <UserMessage key={message.id} message={message} />;
        }
        return (
          <AssistantTurn
            key={message.id}
            message={message}
            nodeMap={nodeMap}
            selectedNodeId={selectedNodeId}
            hoveredNodeId={hoveredNodeId}
            onMessageClick={handleMessageClick}
            onToolClick={handleToolClick}
            onHoverNode={onHoverNode}
            showToolCalls={showToolCalls}
          />
        );
      })}
    </TranscriptRoot>
  );
}

function UserMessage({message}: {message: ConversationMessage}) {
  return (
    <UserBubble>
      <StyledClippedBox
        clipHeight={500}
        buttonProps={{variant: 'secondary', size: 'xs'}}
        clipFade={({showMoreButton}) => (
          <NoFadeClipAction>{showMoreButton}</NoFadeClipAction>
        )}
        collapsible
      >
        <ResponseContent>
          <AIContentRenderer text={message.content} inline autoCollapseLimit={10} />
        </ResponseContent>
      </StyledClippedBox>
    </UserBubble>
  );
}

function AssistantTurn({
  message,
  nodeMap,
  selectedNodeId,
  hoveredNodeId,
  onMessageClick,
  onToolClick,
  onHoverNode,
  showToolCalls,
}: {
  message: ConversationMessage;
  nodeMap: Map<string, AITraceSpanNode>;
  onMessageClick: (message: ConversationMessage) => void;
  onToolClick: (tool: ToolCall) => void;
  selectedNodeId: string | null;
  showToolCalls: boolean;
  hoveredNodeId?: string | null;
  onHoverNode?: (nodeId: string | null) => void;
}) {
  const toolCalls = message.toolCalls ?? [];
  const hasContent = message.content !== '';

  const isMessageHighlighted =
    hoveredNodeId === message.nodeId || toolCalls.some(tc => tc.nodeId === hoveredNodeId);

  return (
    <Flex direction="column" gap="xl" width="100%">
      {showToolCalls && toolCalls.length > 0 && (
        <ToolCallGroup
          toolCalls={toolCalls}
          nodeMap={nodeMap}
          selectedNodeId={selectedNodeId}
          hoveredNodeId={hoveredNodeId}
          onToolClick={onToolClick}
          onHoverNode={onHoverNode}
        />
      )}
      {hasContent && (
        <RowWithDuration>
          <ChatIconContainer>
            <IconChat size="sm" />
          </ChatIconContainer>
          <AssistantResponseBlock
            onClick={() => onMessageClick(message)}
            onMouseEnter={() => onHoverNode?.(message.nodeId)}
            onMouseLeave={() => onHoverNode?.(null)}
            isSelected={
              message.nodeId === selectedNodeId ||
              toolCalls.some(tc => tc.nodeId === selectedNodeId)
            }
            isHighlighted={isMessageHighlighted}
          >
            <StyledClippedBox
              clipHeight={500}
              buttonProps={{variant: 'secondary', size: 'xs'}}
              collapsible
            >
              <ResponseContent>
                <AIContentRenderer text={message.content} inline autoCollapseLimit={10} />
              </ResponseContent>
            </StyledClippedBox>
          </AssistantResponseBlock>
          <DurationText size="sm" monospace variant="muted">
            {message.duration !== undefined && message.duration > 0
              ? formatDuration(message.duration)
              : ''}
          </DurationText>
        </RowWithDuration>
      )}
    </Flex>
  );
}

function ToolCallGroup({
  toolCalls,
  nodeMap,
  selectedNodeId,
  hoveredNodeId,
  onToolClick,
  onHoverNode,
}: {
  nodeMap: Map<string, AITraceSpanNode>;
  onToolClick: (tool: ToolCall) => void;
  selectedNodeId: string | null;
  toolCalls: ToolCall[];
  hoveredNodeId?: string | null;
  onHoverNode?: (nodeId: string | null) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const shouldCollapse = toolCalls.length > COLLAPSED_TOOL_THRESHOLD;

  if (shouldCollapse && !isExpanded) {
    return (
      <CollapsedToolRow onClick={() => setIsExpanded(true)}>
        <ToggleIconContainer>
          <IconChevron size="sm" direction="right" />
        </ToggleIconContainer>
        <Text size="sm" monospace>
          {tn('%s tool call', '%s tool calls', toolCalls.length)}
        </Text>
      </CollapsedToolRow>
    );
  }

  return (
    <Flex direction="column" gap="xl" width="100%">
      {shouldCollapse && (
        <CollapsedToolRow onClick={() => setIsExpanded(false)}>
          <ToggleIconContainer>
            <IconChevron size="sm" direction="down" />
          </ToggleIconContainer>
          <Text size="sm" monospace>
            {tn('%s tool call', '%s tool calls', toolCalls.length)}
          </Text>
        </CollapsedToolRow>
      )}
      {toolCalls.map(tool => (
        <ToolCallRow
          key={tool.nodeId}
          tool={tool}
          nodeMap={nodeMap}
          isSelected={tool.nodeId === selectedNodeId}
          isHighlighted={tool.nodeId === hoveredNodeId}
          onToolClick={onToolClick}
          onHoverNode={onHoverNode}
        />
      ))}
    </Flex>
  );
}

function ToolCallRow({
  tool,
  nodeMap,
  isSelected,
  isHighlighted,
  onToolClick,
  onHoverNode,
}: {
  isSelected: boolean;
  nodeMap: Map<string, AITraceSpanNode>;
  onToolClick: (tool: ToolCall) => void;
  tool: ToolCall;
  isHighlighted?: boolean;
  onHoverNode?: (nodeId: string | null) => void;
}) {
  const toolNode = nodeMap.get(tool.nodeId);
  const inputPreview = toolNode ? getFirstToolInputValue(toolNode) : undefined;
  const duration = toolNode ? getNodeDuration(toolNode) : undefined;

  return (
    <RowWithDuration>
      <ToolRow
        onClick={() => onToolClick(tool)}
        onMouseEnter={() => onHoverNode?.(tool.nodeId)}
        onMouseLeave={() => onHoverNode?.(null)}
        isSelected={isSelected}
        isHighlighted={isHighlighted}
        hasError={tool.hasError}
      >
        <IconContainer>
          {tool.hasError ? <IconFire size="sm" /> : <IconFix size="sm" />}
        </IconContainer>
        <Tag variant={tool.hasError ? 'danger' : 'muted'}>{tool.name}</Tag>
        {inputPreview && (
          <ToolPreviewText size="sm" monospace variant="muted">
            {inputPreview}
          </ToolPreviewText>
        )}
      </ToolRow>
      <DurationText size="sm" monospace variant="muted">
        {duration !== undefined ? formatDuration(duration) : ''}
      </DurationText>
    </RowWithDuration>
  );
}

const TranscriptRoot = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.xl};
  align-items: flex-end;
  padding: ${p => p.theme.space.xl};
  background: ${p => p.theme.tokens.background.primary};
`;

const UserBubble = styled('div')`
  background: ${p => p.theme.tokens.background.secondary};
  border: 1px solid ${p => p.theme.tokens.border.secondary};
  border-radius: ${p => p.theme.radius.md};
  padding: ${p => p.theme.space.xs} ${p => p.theme.space.md};
  max-width: 80%;
  align-self: flex-end;
`;

const AssistantResponseBlock = styled('div')<{
  isHighlighted?: boolean;
  isSelected?: boolean;
}>`
  background: ${p => p.theme.tokens.background.primary};
  border: 1px solid ${p => p.theme.tokens.border.secondary};
  border-radius: 4px;
  padding: ${p => p.theme.space.xs} ${p => p.theme.space.md};
  flex: 1;
  min-width: 0;
  cursor: pointer;
  word-break: break-word;

  &:hover {
    border-color: ${p => p.theme.tokens.border.accent.moderate};
  }

  ${p =>
    p.isHighlighted &&
    `
    border-color: ${p.theme.tokens.border.accent.moderate};
  `}

  ${p =>
    p.isSelected &&
    `
    border-color: ${p.theme.tokens.focus.default};
    &:hover {
      border-color: ${p.theme.tokens.focus.default};
    }
  `}
`;

const ResponseContent = styled('div')`
  font-size: ${p => p.theme.font.size.md};
  line-height: 1.4;
  color: ${p => p.theme.tokens.content.primary};
`;

const ToolRow = styled('div')<{
  hasError?: boolean;
  isHighlighted?: boolean;
  isSelected?: boolean;
}>`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.md};
  flex: 1;
  min-width: 0;
  cursor: pointer;
  border-radius: 4px;
  padding: 2px 4px;
  margin: -2px -4px;

  &:hover {
    background: ${p => p.theme.tokens.background.secondary};
  }

  ${p =>
    p.isHighlighted &&
    `
    background: ${p.theme.tokens.background.secondary};
  `}

  ${p =>
    p.isSelected &&
    `
    background: ${p.theme.tokens.background.transparent.accent.muted};
  `}
`;

const CollapsedToolRow = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.md};
  width: 100%;
  cursor: pointer;
  border-radius: 4px;
  padding: 2px 4px;
  margin: -2px -4px;

  &:hover {
    background: ${p => p.theme.tokens.background.secondary};
  }
`;

const IconContainer = styled('div')`
  display: flex;
  align-items: flex-start;
  justify-content: center;
  width: 20px;
  flex-shrink: 0;
  padding-top: 2px;
  color: ${p => p.theme.tokens.dataviz.categorical[5][0]};
`;

const ChatIconContainer = styled('div')`
  display: flex;
  align-items: flex-start;
  justify-content: center;
  width: 20px;
  flex-shrink: 0;
  padding-top: 2px;
  color: ${p => p.theme.tokens.dataviz.categorical[5][5]};
`;

const RowWithDuration = styled('div')`
  display: flex;
  align-items: start;
  gap: ${p => p.theme.space.md};
  width: 100%;
`;

const DurationText = styled(Text)`
  flex-shrink: 0;
  white-space: nowrap;
  width: 55px;
  text-align: right;
`;

const ToolPreviewText = styled(Text)`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  flex: 1;
`;

const ToggleIconContainer = styled('div')`
  display: flex;
  align-items: flex-start;
  justify-content: center;
  width: 20px;
  flex-shrink: 0;
  padding-top: 2px;
  color: ${p => p.theme.tokens.content.primary};
`;

const StyledClippedBox = styled(ClippedBox)`
  padding: 0;
`;

const NoFadeClipAction = styled('div')`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  text-align: center;
  padding: ${p => p.theme.space.xs} 0;
  pointer-events: none;
  & > * {
    pointer-events: auto;
  }
`;
