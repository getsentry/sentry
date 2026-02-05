import {useCallback, useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import {t} from 'sentry/locale';
import type {useConversationViewDrawer} from 'sentry/views/insights/pages/conversations/components/conversationDrawer';
import type {Conversation} from 'sentry/views/insights/pages/conversations/hooks/useConversations';

// Height for 2 rows of tags (22px per row + 8px gap)
const TWO_ROW_HEIGHT = 52;

interface ToolTagsProps {
  conversation: Conversation;
  openConversationViewDrawer: ReturnType<
    typeof useConversationViewDrawer
  >['openConversationViewDrawer'];
  toolNames: string[];
}

export function ToolTags({
  toolNames,
  conversation,
  openConversationViewDrawer,
}: ToolTagsProps) {
  const [expanded, setExpanded] = useState(false);
  const [hiddenCount, setHiddenCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const tagRefs = useRef<Map<number, HTMLElement>>(new Map());

  const handleToolClick = useCallback(
    (toolName: string) => {
      openConversationViewDrawer({
        conversation,
        source: 'table_tool_tag',
        focusedTool: toolName,
      });
    },
    [conversation, openConversationViewDrawer]
  );

  const handleToggleExpand = useCallback(() => {
    setExpanded(prev => !prev);
  }, []);

  // Calculate how many tags are hidden (overflow beyond 2 rows)
  useEffect(() => {
    if (expanded) {
      return undefined;
    }

    const container = containerRef.current;
    if (!container) {
      return undefined;
    }

    const calculateHidden = () => {
      let hidden = 0;
      tagRefs.current.forEach(tagEl => {
        if (tagEl.offsetTop >= TWO_ROW_HEIGHT) {
          hidden++;
        }
      });
      setHiddenCount(hidden);
    };

    const rafId = requestAnimationFrame(calculateHidden);

    const observer = new ResizeObserver(() => {
      requestAnimationFrame(calculateHidden);
    });
    observer.observe(container);

    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, [toolNames, expanded]);

  return (
    <ToolTagsContainer ref={containerRef} expanded={expanded}>
      {toolNames.map((toolName, index) => (
        <ClickableTag
          key={toolName}
          ref={el => {
            if (el) {
              tagRefs.current.set(index, el);
            } else {
              tagRefs.current.delete(index);
            }
          }}
          variant="info"
          onClick={() => handleToolClick(toolName)}
        >
          {toolName}
        </ClickableTag>
      ))}
      {hiddenCount > 0 && !expanded && (
        <ToggleButtonWrapper>
          <ToggleButton priority="link" size="xs" onClick={handleToggleExpand}>
            {t('+%s more', hiddenCount)}
          </ToggleButton>
        </ToggleButtonWrapper>
      )}
      {expanded && (
        <ToggleButton priority="link" size="xs" onClick={handleToggleExpand}>
          {t('Show less')}
        </ToggleButton>
      )}
    </ToolTagsContainer>
  );
}

const ToolTagsContainer = styled(Flex)<{expanded: boolean}>`
  align-items: center;
  flex-direction: row;
  gap: ${p => p.theme.space.sm};
  flex-wrap: wrap;
  overflow: hidden;
  position: relative;
  max-height: ${p => (p.expanded ? '500px' : `${TWO_ROW_HEIGHT}px`)};
  transition: max-height 0.2s ease-in-out;
`;

const ClickableTag = styled(Tag)`
  cursor: pointer;
  &:hover {
    opacity: 0.8;
  }
`;

const ToggleButtonWrapper = styled('div')`
  position: absolute;
  right: 0;
  bottom: 4px;
  display: flex;
  align-items: center;
  height: 22px;
  background: ${p => p.theme.tokens.background.primary};
  padding-left: ${p => p.theme.space.sm};
`;

const ToggleButton = styled(Button)`
  flex-shrink: 0;
`;
