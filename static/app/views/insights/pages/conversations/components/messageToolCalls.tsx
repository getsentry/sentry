import {useState} from 'react';
import styled from '@emotion/styled';

import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {IconFire} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';
import type {ToolCall} from 'sentry/views/insights/pages/conversations/utils/conversationMessages';

const COLLAPSE_COUNT = 3;

interface CollapsibleTagListProps {
  items: React.ReactNode[];
  failedCount?: number;
}

function CollapsibleTagList({items, failedCount = 0}: CollapsibleTagListProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const visibleItems = isExpanded ? items : items.slice(0, COLLAPSE_COUNT);
  const hiddenCount = items.length - COLLAPSE_COUNT;

  return (
    <Flex align="center" gap="xs" wrap="wrap" flexGrow={1}>
      {visibleItems}
      {!isExpanded && hiddenCount > 0 && (
        <Button priority="link" size="xs" onClick={() => setIsExpanded(true)}>
          {t('+%s more', hiddenCount)}
          {failedCount > 0 && (
            <Text as="span" variant="danger">
              {'\u00A0'}
              {t('(%s failed)', failedCount)}
            </Text>
          )}
        </Button>
      )}
      {isExpanded && items.length > COLLAPSE_COUNT && (
        <Button priority="link" size="xs" onClick={() => setIsExpanded(false)}>
          {t('Show less')}
        </Button>
      )}
    </Flex>
  );
}

interface MessageToolCallsProps {
  nodeMap: Map<string, AITraceSpanNode>;
  onSelectNode: (node: AITraceSpanNode) => void;
  selectedNodeId: string | null;
  toolCalls: ToolCall[];
}

/**
 * Note: the table uses a different collapse mechanism (toolTags.tsx) based on row
 * height via ResizeObserver. This component is intentionally separate and uses a
 * fixed count-based collapse specific to the message bubble context.
 */
export function MessageToolCalls({
  toolCalls,
  selectedNodeId,
  nodeMap,
  onSelectNode,
}: MessageToolCallsProps) {
  const failedCount = toolCalls
    .slice(COLLAPSE_COUNT)
    .filter(tool => tool.hasError).length;

  const items = toolCalls.map(tool => {
    const toolNode = nodeMap.get(tool.nodeId);
    const isToolSelected = tool.nodeId === selectedNodeId;
    return (
      <ClickableTag
        key={tool.nodeId}
        variant={tool.hasError ? 'danger' : 'info'}
        icon={tool.hasError ? <IconFire /> : undefined}
        hasError={tool.hasError}
        isSelected={isToolSelected}
        onClick={e => {
          e.stopPropagation();
          if (toolNode) {
            onSelectNode(toolNode);
          }
        }}
      >
        {tool.name}
      </ClickableTag>
    );
  });

  return (
    <Footer direction="row" align="center" gap="xs" wrap="wrap" padding="xs sm">
      <Text size="xs" style={{opacity: 0.7}}>
        {t('Tools called:')}
      </Text>
      <CollapsibleTagList items={items} failedCount={failedCount} />
    </Footer>
  );
}

const Footer = styled(Flex)`
  border-top: 1px solid ${p => p.theme.tokens.border.primary};
`;

const ClickableTag = styled(Tag)<{hasError?: boolean; isSelected?: boolean}>`
  cursor: pointer;
  &:hover {
    opacity: 0.8;
  }
  ${p =>
    p.isSelected &&
    `
    outline: 2px solid ${p.hasError ? p.theme.tokens.content.danger : p.theme.tokens.focus.default};
    outline-offset: -2px;
  `}
`;
