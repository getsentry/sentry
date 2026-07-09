import {css, useTheme} from '@emotion/react';

import {Container, Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {IconFix} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {formatBytesBase10} from 'sentry/utils/bytes/formatBytesBase10';
import {getDuration} from 'sentry/utils/duration/getDuration';
import {useOrganization} from 'sentry/utils/useOrganization';
import {ToolTag} from 'sentry/views/explore/conversations/components/toolTag';
import {TurnMeta} from 'sentry/views/explore/conversations/components/turnMeta';
import type {ToolCall} from 'sentry/views/explore/conversations/utils/conversationMessages';
import {getToolInputPreview} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';
import {useToolOutputBytes} from 'sentry/views/insights/pages/agents/utils/useToolOutputBytes';

interface MessageToolCallsNewProps {
  nodeMap: Map<string, AITraceSpanNode>;
  nodeTraceMap: Map<string, string>;
  onSelectNode: (node: AITraceSpanNode) => void;
  selectedNodeId: string | null;
  toolCalls: ToolCall[];
}

/**
 * Tool-call list for the redesigned transcript. Each call is a full-width
 * selectable row: accent wrench + `ToolTag` capped at the message width, with
 * the duration right-aligned. Selection shows an outline.
 */
export function MessageToolCallsNew({
  toolCalls,
  selectedNodeId,
  nodeMap,
  nodeTraceMap,
  onSelectNode,
}: MessageToolCallsNewProps) {
  const organization = useOrganization();
  const theme = useTheme();

  // Widen past the content so the outline clears the icon/duration, then pull
  // back with a negative margin to keep them message-aligned (no scraps prop
  // for negative margins or hover).
  const rowCss = css`
    width: calc(100% + ${theme.space.sm} * 2);
    margin: 0 -${theme.space.sm};
    &:hover {
      opacity: 0.85;
    }
  `;

  return (
    <Flex direction="column" gap="xs" width="100%">
      {toolCalls.map(tool => {
        const toolNode = nodeMap.get(tool.nodeId);
        const isToolSelected = tool.nodeId === selectedNodeId;
        const selectTool = () => {
          trackAnalytics('conversations.message.click-tool-call', {
            organization,
          });
          if (toolNode) {
            onSelectNode(toolNode);
          }
        };
        return (
          <Container
            key={tool.nodeId}
            role="button"
            tabIndex={0}
            aria-pressed={isToolSelected}
            aria-label={t('Select tool call %s', tool.name)}
            radius="sm"
            padding="xs sm"
            cursor="pointer"
            css={rowCss}
            style={
              isToolSelected
                ? {
                    outline: `2px solid ${
                      tool.hasError
                        ? theme.tokens.content.danger
                        : theme.tokens.focus.default
                    }`,
                    outlineOffset: '-2px',
                  }
                : undefined
            }
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              selectTool();
            }}
            onKeyDown={(e: React.KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                selectTool();
              }
            }}
          >
            <Flex align="center" justify="between" gap="md" width="100%">
              <Flex align="center" gap="sm" minWidth={0}>
                <Flex align="center" flexShrink={0}>
                  <IconFix size="sm" variant="accent" />
                </Flex>
                <ToolTag name={tool.name} hasError={tool.hasError} />
                {toolNode && <ToolInputPreview node={toolNode} />}
              </Flex>
              <TurnMeta
                metric={
                  toolNode ? (
                    <ToolOutputSize
                      node={toolNode}
                      traceId={nodeTraceMap.get(tool.nodeId)}
                    />
                  ) : null
                }
                duration={
                  tool.duration === undefined || tool.duration <= 0 ? null : (
                    <Text size="xs" variant="muted" tabular align="right">
                      {getDuration(tool.duration, 2, true)}
                    </Text>
                  )
                }
              />
            </Flex>
          </Container>
        );
      })}
    </Flex>
  );
}

function ToolOutputSize({
  node,
  traceId,
}: {
  node: AITraceSpanNode;
  traceId: string | undefined;
}) {
  const bytes = useToolOutputBytes(node, traceId);
  return (
    <Text size="xs" variant="muted" tabular align="right">
      {formatBytesBase10(bytes)}
    </Text>
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
