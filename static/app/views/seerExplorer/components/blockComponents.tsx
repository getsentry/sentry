import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {keyframes} from '@emotion/react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';
import type {LocationDescriptor} from 'history';

import {Button} from '@sentry/scraps/button';
import {inlineCodeStyles} from '@sentry/scraps/code';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {FlippedReturnIcon} from 'sentry/components/events/autofix/insights/autofixInsightCard';
import {
  IconCheckmark,
  IconClose,
  IconCopy,
  IconExclamation,
  IconLink,
  IconThumb,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {MarkedText} from 'sentry/utils/marked/markedText';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {useSessionStorage} from 'sentry/utils/useSessionStorage';
import {getConversationsUrl} from 'sentry/views/insights/pages/conversations/utils/urlParams';
import type {Block, TodoItem} from 'sentry/views/seerExplorer/types';
import {
  buildToolLinkUrl,
  getExplorerUrl,
  getLangfuseUrl,
  getToolsStringFromBlock,
  getValidToolLinks,
  postProcessLLMMarkdown,
} from 'sentry/views/seerExplorer/utils';

interface BlockProps {
  block: Block;
  blockIndex: number;
  getPageReferrer?: () => string;
  isAwaitingFileApproval?: boolean;
  isAwaitingQuestion?: boolean;
  isFocused?: boolean;
  isLast?: boolean;
  isLatestTodoBlock?: boolean;
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
  runId?: number;
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

  return 'content';
}

export function BlockComponent({
  block,
  blockIndex,
  runId,
  getPageReferrer,
  isAwaitingFileApproval,
  isAwaitingQuestion,
  isLast,
  isLatestTodoBlock,
  isFocused,
  onClick,
  onDelete,
  onMouseEnter,
  onMouseLeave,
  onNavigate,
  onRegisterEnterHandler,
  readOnly = false,
  ref,
}: BlockProps) {
  const {copy} = useCopyToClipboard();
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

  // Allow 1 feedback per session. This only writes to session storage on change, not init.
  const [feedbackSubmitted, setFeedbackSubmitted] = useSessionStorage(
    `seer-explorer-feedback:run-${runId ?? 'null'}:block-${block.id}`,
    false
  );

  const trackThumbsFeedback = (type: 'positive' | 'negative') => {
    // Guard against missing runId (shouldn't happen with showActions check, but be defensive)
    // Do this instead of hiding buttons to prevent flickering while data's loading for this edge case.
    if (!feedbackSubmitted && runId !== undefined) {
      trackAnalytics('seer.explorer.feedback_submitted', {
        organization,
        type,
        run_id: runId,
        block_index: blockIndex,
        block_message: block.message.content.slice(0, 100),
        langfuse_url: getLangfuseUrl(runId),
        explorer_url: getExplorerUrl(runId),
        conversations_url: getConversationsUrl('sentry', runId),
      });
      setFeedbackSubmitted(true); // disable button for rest of the session
    }
  };

  const thumbsFeedbackButton = (type: 'positive' | 'negative') => {
    const ariaLabel =
      type === 'positive' ? t('Feedback Thumbs Up') : t('Feedback Thumbs Down');
    return (
      <Button
        aria-label={ariaLabel}
        icon={<IconThumb direction={type === 'positive' ? 'up' : 'down'} />}
        disabled={feedbackSubmitted}
        priority="transparent"
        size="xs"
        tooltipProps={{
          title: feedbackSubmitted
            ? t('Feedback submitted')
            : type === 'positive'
              ? t('I like this response')
              : t("I don't like this response"),
        }}
        onClick={e => {
          e.stopPropagation();
          trackThumbsFeedback(type);
        }}
      >
        {undefined}
      </Button>
    );
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.();
  };

  const handleCopyClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    copy(block.message.content);
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
    !readOnly;
  const showFeedbackButtons = block.message.role === 'assistant';
  const showCopyButton = block.message.role !== 'user' && !!block.message.content?.trim();

  const blockStatus = getToolStatus(block);

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
          <Flex align="start" justify="end" width="100%" padding="xl">
            <UserBlockContent>{block.message.content ?? ''}</UserBlockContent>
          </Flex>
        ) : (
          <Flex align="start" width="100%">
            <BlockStatusIndicator
              status={blockStatus}
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
                      <Stack gap="xs" key={`${toolCall.function}-${idx}`}>
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
                              <ToolCallLinkIconWrapper isHighlighted={isHighlighted}>
                                <ToolCallLinkIcon
                                  size="xs"
                                  isHighlighted={isHighlighted}
                                />
                              </ToolCallLinkIconWrapper>
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
                          <TodoListContent text={todosToMarkdown(block.todos ?? [])} />
                        )}
                      </Stack>
                    );
                  })}
                </ToolCallStack>
              )}
            </BlockContentWrapper>
          </Flex>
        )}
        {showActions && (
          <ActionButtonBar gap="xs">
            {showFeedbackButtons && thumbsFeedbackButton('positive')}
            {showFeedbackButtons && thumbsFeedbackButton('negative')}
            {showCopyButton && (
              <Button
                aria-label={t('Copy block content')}
                icon={<IconCopy />}
                priority="transparent"
                size="xs"
                tooltipProps={{title: t('Copy to clipboard')}}
                onClick={handleCopyClick}
              />
            )}
            <Button
              size="xs"
              priority="transparent"
              onClick={handleDeleteClick}
              tooltipProps={{title: 'Restart conversation from here'}}
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

const Block = styled('div')<{isFocused?: boolean; isLast?: boolean}>`
  width: 100%;
  border-top: 1px solid transparent;
  border-bottom: ${p =>
    p.isLast ? '1px solid transparent' : `1px solid ${p.theme.tokens.border.primary}`};
  position: relative;
  flex-shrink: 0; /* Prevent blocks from shrinking */
`;

function BlockStatusIndicator({
  status,
  hasOnlyTools,
}: {
  status: ReturnType<typeof getToolStatus>;
  hasOnlyTools?: boolean;
}) {
  if (status === 'content') {
    return <BlockIndicatorSpacer />;
  }
  if (status === 'loading' || status === 'pending') {
    return (
      <BlockIndicatorSlot hasOnlyTools={hasOnlyTools}>
        <Tooltip
          title={status === 'pending' ? t('Waiting for approval') : t('Running...')}
        >
          <BlockSpinner />
        </Tooltip>
      </BlockIndicatorSlot>
    );
  }
  if (status === 'failure') {
    return (
      <BlockIndicatorSlot hasOnlyTools={hasOnlyTools}>
        <Tooltip title={t('All tool calls failed')}>
          <BlockFailureIcon size="sm" />
        </Tooltip>
      </BlockIndicatorSlot>
    );
  }
  if (status === 'mixed') {
    return (
      <BlockIndicatorSlot hasOnlyTools={hasOnlyTools}>
        <Tooltip title={t('Some tool calls succeeded and some failed')}>
          <BlockPartialIcon size="sm" />
        </Tooltip>
      </BlockIndicatorSlot>
    );
  }
  return (
    <BlockIndicatorSlot hasOnlyTools={hasOnlyTools}>
      <Tooltip title={t('All tool calls succeeded')}>
        <BlockSuccessIcon size="sm" />
      </Tooltip>
    </BlockIndicatorSlot>
  );
}

const spin = keyframes`
  to { transform: rotate(360deg); }
`;

const Spinner = styled('div')`
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid ${p => p.theme.tokens.border.primary};
  border-left-color: ${p => p.theme.tokens.border.accent.vibrant};
  animation: ${spin} 0.6s linear infinite;
  flex-shrink: 0;
`;

const BlockSpinner = styled(Spinner)`
  width: 18px;
  height: 18px;
`;

const BlockIndicatorSlot = styled('div')<{hasOnlyTools?: boolean}>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  margin-top: ${p => (p.hasOnlyTools ? '10px' : '18px')};
  margin-left: ${p => p.theme.space.xl};
  flex-shrink: 0;
`;

const BlockIndicatorSpacer = styled('div')`
  width: 18px;
  margin-left: ${p => p.theme.space.xl};
  flex-shrink: 0;
`;

const BlockSuccessIcon = styled(IconCheckmark)`
  color: ${p => p.theme.tokens.content.success};
  flex-shrink: 0;
`;

const BlockFailureIcon = styled(IconClose)`
  color: ${p => p.theme.tokens.content.danger};
  flex-shrink: 0;
`;

const BlockPartialIcon = styled(IconExclamation)`
  color: ${p => p.theme.tokens.content.warning};
  flex-shrink: 0;
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
  margin-bottom: -${p => p.theme.space.md};

  code:not(pre code) {
    ${p => inlineCodeStyles(p.theme)};
  }

  p,
  li,
  ul,
  ol {
    margin: -${p => p.theme.space.md} 0;
  }

  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    margin: 0;
    font-size: ${p => p.theme.font.size.lg};
  }

  table {
    border-collapse: collapse;
    width: 100%;
    margin: ${p => p.theme.space.md} 0;
  }

  th,
  td {
    padding: ${p => p.theme.space.md} ${p => p.theme.space.lg};
    text-align: left;
    border: 1px solid ${p => p.theme.tokens.border.primary};
  }

  th {
    background: ${p => p.theme.tokens.background.secondary};
    font-weight: ${p => p.theme.font.weight.sans.medium};
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
  padding: ${p => p.theme.space.md} ${p => p.theme.space.lg};
  white-space: pre-wrap;
  word-wrap: break-word;
  color: ${p => p.theme.tokens.content.primary};
  background: ${p => p.theme.tokens.background.secondary};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: 6px;
`;

const ToolCallStack = styled(Stack)`
  width: 100%;
  min-width: 0;
  padding-right: ${p => p.theme.space.lg};
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
  font-weight: ${p => p.theme.font.weight.sans.medium};

  &:hover {
    /* Apply highlighted styles and underline to ToolCallText on hover */
    ${ToolCallText} {
      color: ${p => p.theme.tokens.interactive.link.accent.hover};
      text-decoration-color: ${p => p.theme.tokens.interactive.link.accent.hover};
    }
  }
`;

const ToolCallLinkIconWrapper = styled('span')<{isHighlighted?: boolean}>`
  display: inline-flex;
  flex-shrink: 0;
  visibility: ${p => (p.isHighlighted ? 'visible' : 'hidden')};

  ${ToolCallLink}:hover & {
    visibility: visible;
  }
`;

const EnterKeyHint = styled('span')<{isVisible?: boolean}>`
  display: inline-block;
  font-size: ${p => p.theme.font.size.xs};
  color: ${p => p.theme.tokens.interactive.link.accent.hover};
  flex-shrink: 0;
  margin-left: ${p => p.theme.space.xs};
  visibility: ${p => (p.isVisible ? 'visible' : 'hidden')};
  font-family: ${p => p.theme.font.family.mono};
  font-weight: ${p => p.theme.font.weight.sans.regular};
`;

const ToolCallLinkIcon = styled(IconLink)<{isHighlighted?: boolean}>`
  color: ${p =>
    p.isHighlighted
      ? p.theme.tokens.interactive.link.accent.hover
      : p.theme.tokens.content.secondary};
  flex-shrink: 0;
`;

const ActionButtonBar = styled(Flex)`
  position: absolute;
  bottom: ${p => p.theme.space['2xs']};
  right: ${p => p.theme.space.md};
  white-space: nowrap;
  font-size: ${p => p.theme.font.size.sm};
  background: ${p => p.theme.tokens.background.primary};
`;

const TodoListContent = styled(MarkedText)`
  margin-top: ${p => p.theme.space.xs};
  margin-bottom: -${p => p.theme.space.xl};
  font-size: ${p => p.theme.font.size.xs};
  font-family: ${p => p.theme.font.family.mono};
  color: ${p => p.theme.tokens.content.secondary};
`;
