import styled from '@emotion/styled';

import {Tag} from '@sentry/scraps/badge';
import {Container, Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {IconFire} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';
import type {ToolCall} from 'sentry/views/insights/pages/conversations/utils/conversationMessages';

interface MessageToolCallsProps {
  nodeMap: Map<string, AITraceSpanNode>;
  onSelectNode: (node: AITraceSpanNode) => void;
  selectedNodeId: string | null;
  toolCalls: ToolCall[];
}

export function MessageToolCalls({
  toolCalls,
  selectedNodeId,
  nodeMap,
  onSelectNode,
}: MessageToolCallsProps) {
  return (
    <Flex direction="column" gap="xs" padding="sm md xs md">
      {toolCalls.map(tool => {
        const toolNode = nodeMap.get(tool.nodeId);
        const isToolSelected = tool.nodeId === selectedNodeId;
        return (
          <ToolCallLine
            key={tool.nodeId}
            background="tertiary"
            radius="sm"
            padding="xs sm"
            cursor="pointer"
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              if (toolNode) {
                onSelectNode(toolNode);
              }
            }}
          >
            <Flex align="center" gap="sm">
              <Text size="xs" monospace variant="muted">
                {t('Called tool')}
              </Text>
              <ClickableTag
                variant={tool.hasError ? 'danger' : 'info'}
                icon={tool.hasError ? <IconFire /> : undefined}
                hasError={tool.hasError}
                isSelected={isToolSelected}
              >
                {tool.name}
              </ClickableTag>
            </Flex>
          </ToolCallLine>
        );
      })}
    </Flex>
  );
}

const ToolCallLine = styled(Container)`
  &:hover {
    opacity: 0.85;
  }
`;

const ClickableTag = styled(Tag)<{hasError?: boolean; isSelected?: boolean}>`
  cursor: pointer;
  padding: 0 ${p => p.theme.space.xs};
  ${p =>
    p.isSelected &&
    `
    outline: 2px solid ${p.hasError ? p.theme.tokens.content.danger : p.theme.tokens.focus.default};
    outline-offset: -2px;
  `}
`;
