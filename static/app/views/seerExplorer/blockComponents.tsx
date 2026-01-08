import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';
import type {LocationDescriptor} from 'history';

import {inlineCodeStyles} from '@sentry/scraps/code/inlineCode';

import {Button} from 'sentry/components/core/button';
import {Flex, Stack} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
import {FlippedReturnIcon} from 'sentry/components/events/autofix/insights/autofixInsightCard';
import {IconChevron, IconLink} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {MarkedText} from 'sentry/utils/marked/markedText';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';

import type {Block, TodoItem} from './types';
import {
  buildToolLinkUrl,
  getToolsStringFromBlock,
  getValidToolLinks,
  postProcessLLMMarkdown,
} from './utils';

interface BlockProps {
  block: Block;
  blockIndex: number;
  getPageReferrer?: () => string;
  isAwaitingFileApproval?: boolean;
  isAwaitingQuestion?: boolean;
  isFocused?: boolean;
  isLast?: boolean;
  isLatestTodoBlock?: boolean;
  isPolling?: boolean;
  onClick?: () => void;
  onDelete?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onNavigate?: () => void;
  onRegisterEnterHandler?: (
    handler: (key: 'Enter' | 'ArrowUp' | 'ArrowDown') => boolean
  ) => void;
  readOnly?: boolean;
  ref?: React.Ref<HTMLDivElement>;
}

function hasValidContent(content: string): boolean {
  if (!content) {
    return false;
  }
  const trimmed = content.trim();
  return trimmed.length > 0 && trimmed !== '.'; // sometimes the LLM just says '.' when calling a tool
}

/**
 * Convert todos to markdown format
 */
function todosToMarkdown(todos: TodoItem[]): string {
  return todos
    .map(todo => {
      const checkbox = todo.status === 'completed' ? '[x]' : '[ ]';
      const content =
        todo.status === 'completed'
          ? `~~${todo.content}~~`
          : todo.status === 'in_progress'
            ? `_${todo.content}_`
            : todo.content;
      return `${checkbox} ${content}`;
    })
    .join('  \n');
}

/**
 * Determine the dot color based on tool execution status
 */
function getToolStatus(
  block: Block
): 'loading' | 'content' | 'success' | 'failure' | 'mixed' | 'pending' {
  if (block.loading) {
    return 'loading';
  }

  // Check tool_links for empty_results metadata
  const toolLinks = block.tool_links || [];
  const toolCalls = block.message.tool_calls || [];
  const hasTools = toolCalls.length > 0;

  if (hasTools) {
    // Check if any tool has pending approval or pending question
    const hasPending = toolLinks.some(
      link => link?.params?.pending_approval || link?.params?.pending_question
    );
    if (hasPending) {
      return 'pending';
    }

    if (toolLinks.length === 0) {
      // No metadata available, assume success
      return 'success';
    }

    let hasSuccess = false;
    let hasFailure = false;

    toolLinks.forEach(link => {
      if (link?.params?.empty_results === true || link?.params?.is_error === true) {
        hasFailure = true;
      } else if (link !== null) {
        hasSuccess = true;
      }
    });

    if (hasFailure && hasSuccess) {
      return 'mixed';
    }
    if (hasFailure) {
      return 'failure';
    }
    return 'success';
  }

  // No tools, check if there's content
  const hasContent = hasValidContent(block.message.content);
  if (hasContent) {
    return 'content';
  }

  return 'success';
}

function BlockComponent({
  block,
  blockIndex: _blockIndex,
  getPageReferrer,
  isAwaitingFileApproval,
  isAwaitingQuestion,
  isLast,
  isLatestTodoBlock,
  isFocused,
  isPolling,
  onClick,
  onDelete,
  onMouseEnter,
  onMouseLeave,
  onNavigate,
  onRegisterEnterHandler,
  readOnly = false,
  ref,
}: BlockProps) {
  const organization = useOrganization();
  const navigate = useNavigate();
  const {projects} = useProjects();

  const toolsUsed = getToolsStringFromBlock(block);
  const hasTools = toolsUsed.length > 0;
  const hasContent = hasValidContent(block.message.content);
  const processedContent = useMemo(
    () => postProcessLLMMarkdown(block.message.content),
    [block.message.content]
  );

  // State to track selected tool link (for navigation)
  const [selectedLinkIndex, setSelectedLinkIndex] = useState(0);
  const selectedLinkIndexRef = useRef(selectedLinkIndex);

  // Keep ref in sync with state
  useEffect(() => {
    selectedLinkIndexRef.current = selectedLinkIndex;
  }, [selectedLinkIndex]);

  // Get valid tool links sorted by their corresponding tool call indices
  // Also create a mapping from tool call index to sorted link index
  const {sortedToolLinks, toolCallToLinkIndexMap} = useMemo(() => {
    return getValidToolLinks(
      block.tool_links || [],
      block.tool_results || [],
      block.message.tool_calls || [],
      organization.slug,
      projects
    );
  }, [
    block.tool_links,
    block.tool_results,
    block.message.tool_calls,
    organization.slug,
    projects,
  ]);

  const hasValidLinks = sortedToolLinks.length > 0;

  // Reset selected index when block changes or when there are no valid links
  useEffect(() => {
    if (!hasValidLinks) {
      setSelectedLinkIndex(0);
    } else if (selectedLinkIndex >= sortedToolLinks.length) {
      setSelectedLinkIndex(0);
    }
  }, [hasValidLinks, selectedLinkIndex, sortedToolLinks.length]);

  // Tool link navigation, with analytics and onNavigate hook.
  const navigateToToolLink = useCallback(
    (url: LocationDescriptor, toolKind: string) => {
      trackAnalytics('seer.explorer.global_panel.tool_link_navigation', {
        referrer: getPageReferrer?.() ?? '',
        organization,
        tool_kind: toolKind,
      });
      navigate(url);
      onNavigate?.();
    },
    [organization, navigate, onNavigate, getPageReferrer]
  );

  // Register the key handler with the parent
  useEffect(() => {
    const handler = (key: 'Enter' | 'ArrowUp' | 'ArrowDown') => {
      if (!hasValidLinks) {
        return false;
      }

      if (key === 'ArrowUp') {
        // Move to previous link
        const currentIndex = selectedLinkIndexRef.current;
        if (currentIndex > 0) {
          // Can move up within this block's links
          setSelectedLinkIndex(prev => prev - 1);
          return true;
        }
        // At the first link, let navigation move to previous block
        return false;
      }

      if (key === 'ArrowDown') {
        // Move to next link
        const currentIndex = selectedLinkIndexRef.current;
        if (currentIndex < sortedToolLinks.length - 1) {
          // Can move down within this block's links
          setSelectedLinkIndex(prev => prev + 1);
          return true;
        }
        // At the last link, let navigation move to next block
        return false;
      }

      if (key === 'Enter') {
        // Navigate to selected link using ref to get current value
        const currentIndex = selectedLinkIndexRef.current;
        const selectedLink = sortedToolLinks[currentIndex];
        if (selectedLink) {
          const url = buildToolLinkUrl(selectedLink, organization.slug, projects);
          if (url) {
            navigateToToolLink(url, selectedLink.kind);
          }
        }
        return true;
      }
      return false;
    };

    onRegisterEnterHandler?.(handler);
  }, [
    hasValidLinks,
    sortedToolLinks,
    organization.slug,
    projects,
    navigate,
    onNavigate,
    onRegisterEnterHandler,
    navigateToToolLink,
  ]);

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.();
  };

  const handleNavigateClick = (e: React.MouseEvent, linkIndex: number) => {
    e.stopPropagation();
    if (sortedToolLinks.length === 0) {
      return;
    }

    // Navigate to the clicked link
    const selectedLink = sortedToolLinks[linkIndex];
    if (selectedLink) {
      const url = buildToolLinkUrl(selectedLink, organization.slug, projects);
      if (url) {
        navigateToToolLink(url, selectedLink.kind);
      }
    }
  };

  const showActions =
    isFocused &&
    !block.loading &&
    !isAwaitingFileApproval &&
    !isAwaitingQuestion &&
    !readOnly; // move this check to inside button bar once there are more actions

  return (
    <Block
      ref={ref}
      isFocused={isFocused}
      isLast={isLast}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <motion.div initial={{opacity: 0, x: 10}} animate={{opacity: 1, x: 0}}>
        {block.message.role === 'user' ? (
          <BlockRow>
            <BlockChevronIcon direction="right" size="sm" />
            <UserBlockContent>{block.message.content ?? ''}</UserBlockContent>
          </BlockRow>
        ) : (
          <BlockRow>
            <ResponseDot
              status={getToolStatus(block)}
              hasOnlyTools={!hasContent && hasTools}
            />
            <BlockContentWrapper hasOnlyTools={!hasContent && hasTools}>
              {hasContent && (
                <BlockContent
                  text={processedContent}
                  onClick={(e: React.MouseEvent<HTMLDivElement>) => {
                    // Intercept clicks on links to use client-side navigation for internal links
                    // and open external links in a new tab
                    const anchor = (e.target as HTMLElement).closest('a');
                    if (anchor) {
                      const href = anchor.getAttribute('href');
                      if (!href) {
                        return;
                      }

                      e.preventDefault();
                      e.stopPropagation();

                      if (href.startsWith('/')) {
                        navigate(href);
                        onNavigate?.();
                      } else {
                        window.open(href, '_blank', 'noopener,noreferrer');
                      }
                    }
                  }}
                />
              )}
              {hasTools && (
                <ToolCallStack gap="md">
                  {block.message.tool_calls?.map((toolCall, idx) => {
                    const toolString = toolsUsed[idx];
                    // Check if this tool call corresponds to the selected link
                    const correspondingLinkIndex = toolCallToLinkIndexMap.get(idx);
                    const hasLink = correspondingLinkIndex !== undefined;
                    const isHighlighted =
                      isFocused &&
                      hasValidLinks &&
                      correspondingLinkIndex !== undefined &&
                      correspondingLinkIndex === selectedLinkIndex;
                    const isTodoWriteCall = toolCall.function === 'todo_write';
                    const showTodoList =
                      isTodoWriteCall &&
                      isLatestTodoBlock &&
                      block.todos &&
                      block.todos.length > 0;

                    return (
                      <ToolCallWithTodos key={`${toolCall.function}-${idx}`}>
                        <ToolCallTextContainer>
                          {hasLink ? (
                            <ToolCallLink
                              onClick={e =>
                                handleNavigateClick(e, correspondingLinkIndex)
                              }
                              onMouseEnter={() =>
                                setSelectedLinkIndex(correspondingLinkIndex)
                              }
                              isHighlighted={isHighlighted}
                            >
                              <ToolCallText
                                size="xs"
                                variant="muted"
                                monospace
                                isHighlighted={isHighlighted}
                              >
                                {toolString}
                              </ToolCallText>
                              <ToolCallLinkIcon size="xs" isHighlighted={isHighlighted} />
                              <EnterKeyHint isVisible={isHighlighted}>
                                enter ⏎
                              </EnterKeyHint>
                            </ToolCallLink>
                          ) : (
                            <ToolCallText
                              size="xs"
                              variant="muted"
                              monospace
                              isHighlighted={false}
                            >
                              {toolString}
                            </ToolCallText>
                          )}
                        </ToolCallTextContainer>
                        {showTodoList && (
                          <TodoListContent text={todosToMarkdown(block.todos!)} />
                        )}
                      </ToolCallWithTodos>
                    );
                  })}
                </ToolCallStack>
              )}
            </BlockContentWrapper>
          </BlockRow>
        )}
        {showActions && !isPolling && (
          <ActionButtonBar gap="xs">
            <Button
              size="xs"
              priority="transparent"
              onClick={handleDeleteClick}
              title="Restart conversation from here"
            >
              <FlippedReturnIcon />
            </Button>
          </ActionButtonBar>
        )}
      </motion.div>
    </Block>
  );
}

BlockComponent.displayName = 'BlockComponent';

export default BlockComponent;

const Block = styled('div')<{isFocused?: boolean; isLast?: boolean}>`
  width: 100%;
  border-top: 1px solid transparent;
  border-bottom: ${p =>
    p.isLast ? '1px solid transparent' : `1px solid ${p.theme.border}`};
  position: relative;
  flex-shrink: 0; /* Prevent blocks from shrinking */
`;

const BlockRow = styled('div')`
  display: flex;
  align-items: flex-start;
  width: 100%;
`;

const BlockChevronIcon = styled(IconChevron)`
  color: ${p => p.theme.subText};
  margin-top: 18px;
  margin-left: ${space(2)};
  margin-right: ${space(1)};
  flex-shrink: 0;
`;

const ResponseDot = styled('div')<{
  status: 'loading' | 'content' | 'success' | 'failure' | 'mixed' | 'pending';
  hasOnlyTools?: boolean;
}>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-top: ${p => (p.hasOnlyTools ? '12px' : '22px')};
  margin-left: ${space(2)};
  flex-shrink: 0;
  background: ${p => {
    switch (p.status) {
      case 'loading':
        return p.theme.tokens.content.promotion;
      case 'pending':
        return p.theme.tokens.content.promotion;
      case 'content':
        return p.theme.tokens.content.accent;
      case 'success':
        return p.theme.tokens.content.success;
      case 'failure':
        return p.theme.tokens.content.danger;
      case 'mixed':
        return p.theme.tokens.content.warning;
      default:
        return p.theme.tokens.content.accent;
    }
  }};

  ${p =>
    p.status === 'loading' &&
    `
    animation: blink 1s infinite;

    @keyframes blink {
      0%, 50% { opacity: 1; }
      51%, 100% { opacity: 0.3; }
    }
  `}
`;

const BlockContentWrapper = styled('div')<{hasOnlyTools?: boolean}>`
  padding: ${p =>
    p.hasOnlyTools ? `${p.theme.space.md} ${p.theme.space.xl}` : p.theme.space.xl};
  flex: 1;
  min-width: 0;
  overflow: hidden;
`;

const BlockContent = styled(MarkedText)`
  width: 100%;
  color: ${p => p.theme.tokens.content.primary};
  white-space: pre-wrap;
  word-wrap: break-word;
  padding-bottom: 0;
  margin-bottom: -${space(1)};

  code:not(pre code) {
    ${p => inlineCodeStyles(p.theme)};
  }

  p,
  li,
  ul,
  ol {
    margin: -${space(1)} 0;
  }

  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    margin: 0;
    font-size: ${p => p.theme.fontSize.lg};
  }

  p:first-child,
  li:first-child,
  ul:first-child,
  h1:first-child,
  h2:first-child,
  h3:first-child,
  h4:first-child,
  h5:first-child,
  h6:first-child {
    margin-top: 0;
  }
`;

const UserBlockContent = styled('div')`
  width: 100%;
  padding: ${space(2)} ${space(2)} ${space(2)} 0;
  white-space: pre-wrap;
  word-wrap: break-word;
  color: ${p => p.theme.subText};
`;

const ToolCallStack = styled(Stack)`
  width: 100%;
  min-width: 0;
  padding-right: ${p => p.theme.space.lg};
`;

const ToolCallWithTodos = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.xs};
`;

const ToolCallTextContainer = styled('div')`
  display: inline-flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
  max-width: 100%;
`;

const ToolCallText = styled(Text)<{isHighlighted?: boolean}>`
  white-space: normal;
  overflow: visible;
  text-decoration: underline;
  text-decoration-color: transparent;
  ${p =>
    p.isHighlighted &&
    `
    color: ${p.theme.tokens.interactive.link.accent.hover};
  `}
`;

const ToolCallLink = styled('button')<{isHighlighted?: boolean}>`
  display: inline-flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
  max-width: 100%;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  text-align: left;
  font-weight: ${p => p.theme.fontWeight.bold};

  &:hover {
    /* Apply highlighted styles and underline to ToolCallText on hover */
    ${ToolCallText} {
      color: ${p => p.theme.tokens.interactive.link.accent.hover};
      text-decoration-color: ${p => p.theme.tokens.interactive.link.accent.hover};
    }
  }
`;

const EnterKeyHint = styled('span')<{isVisible?: boolean}>`
  display: inline-block;
  font-size: ${p => p.theme.fontSize.xs};
  color: ${p => p.theme.tokens.interactive.link.accent.hover};
  flex-shrink: 0;
  margin-left: ${p => p.theme.space.xs};
  visibility: ${p => (p.isVisible ? 'visible' : 'hidden')};
  font-family: ${p => p.theme.text.familyMono};
  font-weight: ${p => p.theme.fontWeight.normal};
`;

const ToolCallLinkIcon = styled(IconLink)<{isHighlighted?: boolean}>`
  color: ${p =>
    p.isHighlighted ? p.theme.tokens.interactive.link.accent.hover : p.theme.subText};
  flex-shrink: 0;
`;

const ActionButtonBar = styled(Flex)`
  position: absolute;
  bottom: ${p => p.theme.space['2xs']};
  right: ${p => p.theme.space.md};
  white-space: nowrap;
  font-size: ${p => p.theme.fontSize.sm};
  background: ${p => p.theme.tokens.background.primary};
`;

const TodoListContent = styled(MarkedText)`
  margin-top: ${p => p.theme.space.xs};
  margin-bottom: -${p => p.theme.space.xl};
  font-size: ${p => p.theme.fontSize.xs};
  font-family: ${p => p.theme.text.familyMono};
  color: ${p => p.theme.subText};
`;
