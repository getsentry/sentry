import {css, useTheme} from '@emotion/react';

import {Tag} from '@sentry/scraps/badge';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {IconFire} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {ToolCall} from 'sentry/views/explore/conversations/utils/conversationMessages';
import {getToolInputPreview} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';

interface MessageToolCallsProps {
  nodeMap: Map<string, AITraceSpanNode>;
  onSelectNode: (node: AITraceSpanNode) => void;
  selectedNodeId: string | null;
  toolCalls: ToolCall[];
}

const hoverStyle = css`
  &:hover {
    opacity: 0.85;
  }
`;

export function MessageToolCalls({
  toolCalls,
  selectedNodeId,
  nodeMap,
  onSelectNode,
}: MessageToolCallsProps) {
  const organization = useOrganization();
  const theme = useTheme();

  return (
    <Stack gap="xs" padding="sm md xs md">
      {toolCalls.map(tool => {
        const toolNode = nodeMap.get(tool.nodeId);
        const isToolSelected = tool.nodeId === selectedNodeId;
        return (
          <Container
            key={tool.nodeId}
            background="tertiary"
            radius="sm"
            padding="xs sm"
            cursor="pointer"
            css={hoverStyle}
            style={
              isToolSelected
                ? {
                    outline: `2px solid ${tool.hasError ? theme.tokens.content.danger : theme.tokens.focus.default}`,
                    outlineOffset: '-2px',
                  }
                : undefined
            }
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              trackAnalytics('conversations.message.click-tool-call', {organization});
              if (toolNode) {
                onSelectNode(toolNode);
              }
            }}
          >
            <Flex align="baseline" gap="sm">
              <Container flexShrink={0}>
                <Text size="xs" monospace variant="muted">
                  {t('Called tool')}
                </Text>
              </Container>
              <Tag
                variant={tool.hasError ? 'danger' : 'info'}
                icon={tool.hasError ? <IconFire /> : undefined}
              >
                {tool.name}
              </Tag>
              {toolNode && <ToolInputPreview node={toolNode} />}
            </Flex>
          </Container>
        );
      })}
    </Stack>
  );
}

function ToolInputPreview({node}: {node: AITraceSpanNode}) {
  const inputPreview = getToolInputPreview(node);
  if (!inputPreview) {
    return null;
  }
  return (
    <Text size="xs" monospace variant="muted" ellipsis>
      {inputPreview}
    </Text>
  );
}
