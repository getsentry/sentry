import {createContext, Fragment, useContext, useMemo} from 'react';
import {keyframes} from '@emotion/react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import {Button} from '@sentry/scraps/button';
import {Checkbox} from '@sentry/scraps/checkbox';
import {Disclosure} from '@sentry/scraps/disclosure';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Markdown, type MarkdownProps} from '@sentry/scraps/markdown';
import {Heading, Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {
  IconCheckmark,
  IconClose,
  IconCopy,
  IconLink,
  IconLinkBroken,
  IconThumb,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {unreachable} from 'sentry/utils/unreachable';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {useSessionStorage} from 'sentry/utils/useSessionStorage';
import {getConversationsUrlForExternalUse} from 'sentry/views/explore/conversations/utils/urlParams';
import type {Block, TodoItem} from 'sentry/views/seerExplorer/types';
import {
  buildToolLinkUrl,
  getExplorerUrl,
  getLangfuseUrl,
  getToolsStringFromBlock,
  getValidToolLinks,
} from 'sentry/views/seerExplorer/utils';

// ─── Context ────────────────────────────────────────────────

interface BlockContextValue {
  block: Block;
  blockIndex: number;
  blocksLength: number;
  getPageReferrer?: () => string;
  interactionPending?: boolean;
  runId?: number;
}

const BlockContext = createContext<BlockContextValue | null>(null);

function useBlockContext(): BlockContextValue {
  const ctx = useContext(BlockContext);
  if (!ctx) {
    throw new Error('useBlockContext must be used within a BlockComponent');
  }
  return ctx;
}

// ─── Export ──────────────────────────────────────────────────

interface BlockProps {
  block: Block;
  blockIndex: number;
  blocksLength: number;
  getPageReferrer?: () => string;
  interactionPending?: boolean;
  onClick?: () => void;
  ref?: React.Ref<HTMLDivElement>;
  runId?: number;
}

export function BlockComponent({
  block,
  blockIndex,
  blocksLength,
  runId,
  getPageReferrer,
  interactionPending,
  onClick,
  ref,
}: BlockProps) {
  const contextValue = useMemo(
    () => ({block, blockIndex, blocksLength, getPageReferrer, interactionPending, runId}),
    [block, blockIndex, blocksLength, getPageReferrer, interactionPending, runId]
  );

  return (
    <BlockContext.Provider value={contextValue}>
      <BlockWrapper ref={ref} onClick={onClick}>
        <motion.div initial={{opacity: 0, x: 10}} animate={{opacity: 1, x: 0}}>
          <BlockVariant />
        </motion.div>
      </BlockWrapper>
    </BlockContext.Provider>
  );
}

BlockComponent.displayName = 'BlockComponent';

function BlockVariant() {
  const variant = useBlockVariant();

  switch (variant) {
    case 'user':
      return <UserBlock />;
    case 'thinking':
      return <ThinkingBlock />;
    case 'agent':
      return <AgentBlock />;
    default:
      return unreachable(variant);
  }
}

// ─── Variants ────────────────────────────────────────────────

function AgentBlock() {
  const {block, blockIndex, blocksLength, interactionPending} = useBlockContext();
  const isStreaming = blockIndex === blocksLength - 1;
  const toolsUsed = getToolsStringFromBlock(block);
  const hasTools = toolsUsed.length > 0;

  return (
    <Flex align="start" width="100%">
      <Container padding="xl" flex={1} minWidth={0} overflow="hidden">
        {hasValidContent(block.message.thinking_content) && (
          <Disclosure>
            <Disclosure.Title>
              <Text size="xs" variant="muted" monospace>
                {t('Thinking')}
              </Text>
            </Disclosure.Title>
            <Disclosure.Content>
              <SeerMarkdown raw={block.message.thinking_content} />
            </Disclosure.Content>
          </Disclosure>
        )}
        {hasTools && <ToolCallList />}
        {hasValidContent(block.message.content) && (
          <SeerMarkdown
            raw={block.message.content}
            variant={isStreaming ? 'streaming' : 'static'}
          />
        )}
      </Container>
      {!block.loading && !interactionPending && <BlockActionBar />}
    </Flex>
  );
}

function UserBlock() {
  const {block} = useBlockContext();
  return (
    <Flex align="start" justify="end" width="100%" padding="xl">
      <UserBubble>{block.message.content ?? ''}</UserBubble>
    </Flex>
  );
}

function ThinkingBlock() {
  const {block} = useBlockContext();
  return (
    <Flex align="center" gap="md" padding="xl" width="100%">
      <Flex
        display="inline-flex"
        align="center"
        justify="center"
        width="12px"
        height="12px"
        flexShrink={0}
      >
        <Spinner />
      </Flex>
      <SeerMarkdown raw={block.message.content ?? ''} />
    </Flex>
  );
}

// ─── Types ───────────────────────────────────────────────────

type BlockVariant = 'user' | 'agent' | 'thinking';

type ToolCallStatus = 'pending' | 'success' | 'failure';

// ─── Hooks ───────────────────────────────────────────────────

function useBlockVariant(): BlockVariant {
  const {block} = useBlockContext();
  if (block.message.role === 'user') {
    return 'user';
  }
  const hasTools = (block.message.tool_calls ?? []).length > 0;
  if (block.loading && !hasTools) {
    return 'thinking';
  }
  return 'agent';
}

function useToolLinks() {
  const organization = useOrganization();
  const {projects} = useProjects();
  const {block} = useBlockContext();

  const {sortedToolLinks, toolCallToLinkIndexMap} = useMemo(() => {
    return getValidToolLinks(
      block.tool_links || [],
      block.tool_results || [],
      block.message.tool_calls || [],
      organization,
      projects
    );
  }, [
    block.tool_links,
    block.tool_results,
    block.message.tool_calls,
    organization,
    projects,
  ]);

  const toolLinkByCallId = useMemo(() => {
    const map = new Map<string, Record<string, any> | undefined>();
    (block.tool_results || []).forEach((result, idx) => {
      if (result?.tool_call_id) {
        map.set(result.tool_call_id, block.tool_links?.[idx]?.params);
      }
    });
    return map;
  }, [block.tool_links, block.tool_results]);

  return {
    sortedToolLinks,
    toolCallToLinkIndexMap,
    toolLinkByCallId,
    organization,
    projects,
  };
}

function useBlockFeedback(block: Block, blockIndex: number, runId: number | undefined) {
  const organization = useOrganization();
  const [feedbackSubmitted, setFeedbackSubmitted] = useSessionStorage(
    `seer-explorer-feedback:run-${runId ?? 'null'}:block-${block.id}`,
    false
  );

  const trackFeedback = (type: 'positive' | 'negative') => {
    if (!feedbackSubmitted && runId !== undefined) {
      trackAnalytics('seer.explorer.feedback_submitted', {
        organization,
        type,
        run_id: runId,
        block_index: blockIndex,
        block_message: block.message.content?.slice(0, 100) ?? '',
        langfuse_url: getLangfuseUrl(runId),
        explorer_url: getExplorerUrl(runId),
        conversations_url: getConversationsUrlForExternalUse('sentry', runId),
      });
      setFeedbackSubmitted(true);
    }
  };

  return {feedbackSubmitted, trackFeedback};
}

// ─── Mid-level Components ────────────────────────────────────

function ToolCallList() {
  const {block, getPageReferrer} = useBlockContext();
  const {
    sortedToolLinks,
    toolCallToLinkIndexMap,
    toolLinkByCallId,
    organization,
    projects,
  } = useToolLinks();
  const toolsUsed = getToolsStringFromBlock(block);

  return (
    <Stack gap="md" width="100%" minWidth={0} paddingRight="lg">
      {block.message.tool_calls?.map((toolCall, idx) => {
        const correspondingLinkIndex = toolCallToLinkIndexMap.get(idx);
        const toolLinkParams = toolCall.id
          ? toolLinkByCallId.get(toolCall.id)
          : undefined;
        const status = getToolCallStatus(block.loading, toolLinkParams);
        const hasLink = correspondingLinkIndex !== undefined;
        const toolUrl = hasLink
          ? buildToolLinkUrl(
              sortedToolLinks[correspondingLinkIndex],
              organization,
              projects
            )
          : null;

        const handleLinkClick = hasLink
          ? (e: React.MouseEvent) => {
              e.stopPropagation();
              const selectedLink = sortedToolLinks[correspondingLinkIndex];
              if (selectedLink) {
                trackAnalytics('seer.explorer.global_panel.tool_link_navigation', {
                  referrer: getPageReferrer?.() ?? '',
                  organization,
                  tool_kind: selectedLink.kind,
                });
              }
            }
          : undefined;

        const isTodoWrite = toolCall.function === 'todo_write';
        const todos =
          isTodoWrite && block.todos && block.todos.length > 0 ? block.todos : null;

        const failureTooltip = toolLinkParams?.is_error
          ? t('Tool call failed')
          : toolLinkParams?.empty_results
            ? t('Tool call returned empty results')
            : null;

        return (
          <ToolCallRow
            key={`${toolCall.function}-${idx}`}
            toolString={toolsUsed[idx] ?? ''}
            status={status}
            toolUrl={toolUrl}
            failureTooltip={failureTooltip}
            onLinkClick={handleLinkClick}
            todos={todos}
          />
        );
      })}
    </Stack>
  );
}

function ToolCallRow({
  toolString,
  status,
  toolUrl,
  failureTooltip,
  onLinkClick,
  todos,
}: {
  failureTooltip: string | null;
  status: ToolCallStatus;
  todos: TodoItem[] | null;
  toolString: string;
  toolUrl: ReturnType<typeof buildToolLinkUrl>;
  onLinkClick?: (e: React.MouseEvent) => void;
}) {
  const hasLink = toolUrl !== null;
  const isLoading = status === 'pending';

  const toolCallText = (
    <Tooltip title={failureTooltip ?? ''} disabled={!failureTooltip}>
      <ToolCallText size="xs" variant="muted" monospace>
        {toolString}
      </ToolCallText>
    </Tooltip>
  );

  return (
    <Stack gap="xs">
      <Flex display="inline-flex" align="start" gap="md" maxWidth="100%">
        <Flex
          display="inline-flex"
          align="center"
          justify="center"
          width="12px"
          height="12px"
          flexShrink={0}
        >
          <BlockStatusIndicator status={status} />
        </Flex>
        {hasLink ? (
          <ToolCallLink to={toolUrl} onClick={onLinkClick}>
            {toolCallText}
            <ToolCallLinkIconWrapper>
              <ToolCallLinkIcon size="xs" />
            </ToolCallLinkIconWrapper>
          </ToolCallLink>
        ) : (
          <ToolCallPlainRow>
            {toolCallText}
            <ToolCallBrokenLinkIconWrapper isLoading={isLoading}>
              <ToolCallBrokenLinkIcon size="xs" />
            </ToolCallBrokenLinkIconWrapper>
          </ToolCallPlainRow>
        )}
      </Flex>
      {todos && <TodoList todos={todos} />}
    </Stack>
  );
}

function BlockActionBar() {
  const {block, blockIndex, runId} = useBlockContext();
  const {feedbackSubmitted, trackFeedback} = useBlockFeedback(block, blockIndex, runId);
  const {copy} = useCopyToClipboard();
  const showCopy = !!block.message.content?.trim();

  return (
    <ActionBarWrapper gap="xs">
      <FeedbackButton
        type="positive"
        disabled={feedbackSubmitted}
        onClick={trackFeedback}
      />
      <FeedbackButton
        type="negative"
        disabled={feedbackSubmitted}
        onClick={trackFeedback}
      />
      {showCopy && (
        <Button
          aria-label={t('Copy block content')}
          icon={<IconCopy />}
          variant="transparent"
          size="xs"
          tooltipProps={{title: t('Copy to clipboard')}}
          onClick={e => {
            e.stopPropagation();
            copy(block.message.content ?? '');
          }}
        >
          {undefined}
        </Button>
      )}
    </ActionBarWrapper>
  );
}

// ─── Leaf Components ─────────────────────────────────────────

const ISSUE_SHORT_ID_PATTERN =
  /\b((?:[A-Z][A-Z0-9_]+|[0-9_]+[A-Z][A-Z0-9_]*)(?:-[A-Z0-9]+)+)\b/;

function IssueIdText({children}: {children: string}) {
  const parts = children.split(ISSUE_SHORT_ID_PATTERN);
  if (parts.length === 1) {
    return children;
  }
  return (
    <Fragment>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <Link key={i} to={`/issues/${part}/`}>
            {part}
          </Link>
        ) : (
          part
        )
      )}
    </Fragment>
  );
}

const SEER_MARKDOWN_COMPONENTS: MarkdownProps['components'] = {
  Text: IssueIdText,
  Heading: ({children, level}) => (
    <Heading as={`h${level}`} size="lg">
      {children}
    </Heading>
  ),
};

function SeerMarkdown(props: Omit<MarkdownProps, 'components'>) {
  return <Markdown {...props} components={SEER_MARKDOWN_COMPONENTS} />;
}

function TodoList({todos}: {todos: TodoItem[]}) {
  return (
    <Stack as="ul" gap="sm" padding="0">
      {todos.map(todo => {
        const checked = todo.status === 'completed';
        return (
          <Flex key={todo.content} as="li" gap="sm" align="center">
            <Checkbox size="xs" checked={checked} readOnly />
            <Text size="xs" monospace strikethrough={checked} variant="muted">
              {todo.content}
            </Text>
          </Flex>
        );
      })}
    </Stack>
  );
}

function BlockStatusIndicator({status}: {status: ToolCallStatus}) {
  switch (status) {
    case 'pending':
      return (
        <Tooltip title={t('Running...')}>
          <Spinner />
        </Tooltip>
      );
    case 'failure':
      return (
        <Tooltip title={t('Failed')}>
          <Text variant="danger">
            <IconClose size="xs" />
          </Text>
        </Tooltip>
      );
    case 'success':
      return (
        <Tooltip title={t('Completed')}>
          <Text variant="success">
            <IconCheckmark size="xs" />
          </Text>
        </Tooltip>
      );
    default:
      return unreachable(status);
  }
}

function FeedbackButton({
  type,
  disabled,
  onClick,
}: {
  disabled: boolean;
  onClick: (type: 'positive' | 'negative') => void;
  type: 'positive' | 'negative';
}) {
  const ariaLabel =
    type === 'positive' ? t('Feedback Thumbs Up') : t('Feedback Thumbs Down');
  return (
    <Button
      aria-label={ariaLabel}
      icon={<IconThumb direction={type === 'positive' ? 'up' : 'down'} />}
      disabled={disabled}
      variant="transparent"
      size="xs"
      tooltipProps={{
        title: disabled
          ? t('Feedback submitted')
          : type === 'positive'
            ? t('I like this response')
            : t("I don't like this response"),
      }}
      onClick={e => {
        e.stopPropagation();
        onClick(type);
      }}
    >
      {undefined}
    </Button>
  );
}

// ─── Pure Functions ──────────────────────────────────────────

function getToolCallStatus(
  blockLoading: boolean | undefined,
  toolLinkParams?: Record<string, any>
): ToolCallStatus {
  if (
    blockLoading ||
    toolLinkParams?.pending_approval ||
    toolLinkParams?.pending_question
  ) {
    return 'pending';
  }
  if (toolLinkParams?.is_error || toolLinkParams?.empty_results) {
    return 'failure';
  }
  return 'success';
}

function hasValidContent(content: string | null | undefined): content is string {
  if (!content) {
    return false;
  }
  const trimmed = content.trim();
  return trimmed.length > 0 && trimmed !== '.';
}

// ─── Styled Components ──────────────────────────────────────
// Ordered by CSS reference dependencies (referenced before referencing).

const spin = keyframes`
  to { transform: rotate(360deg); }
`;

const Spinner = styled('div')`
  box-sizing: border-box;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 1.5px solid ${p => p.theme.tokens.border.primary};
  border-left-color: ${p => p.theme.tokens.border.accent.vibrant};
  animation: ${spin} 0.6s linear infinite;
  flex-shrink: 0;
`;

const BlockWrapper = styled('div')`
  width: 100%;
  position: relative;
  flex-shrink: 0;
`;

const ToolCallText = styled(Text)`
  white-space: normal;
  overflow: visible;
  text-decoration: underline;
  text-decoration-color: transparent;
`;

const ToolCallLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: ${p => p.theme.space.md};
  max-width: 100%;
  padding: 0;
  cursor: pointer;
  text-decoration: none;
  font-weight: ${p => p.theme.font.weight.sans.medium};

  &:hover {
    ${ToolCallText} {
      color: ${p => p.theme.tokens.interactive.link.accent.hover};
      text-decoration-color: ${p => p.theme.tokens.interactive.link.accent.hover};
    }
  }
`;

const ToolCallLinkIconWrapper = styled('span')`
  display: inline-flex;
  flex-shrink: 0;
  visibility: hidden;

  ${ToolCallLink}:hover & {
    visibility: visible;
  }
`;

const ToolCallLinkIcon = styled(IconLink)`
  color: ${p => p.theme.tokens.content.secondary};
  flex-shrink: 0;

  ${ToolCallLink}:hover & {
    color: ${p => p.theme.tokens.interactive.link.accent.hover};
  }
`;

const ToolCallPlainRow = styled('span')`
  display: inline-flex;
  align-items: center;
  gap: ${p => p.theme.space.md};
  max-width: 100%;
`;

const ToolCallBrokenLinkIcon = styled(IconLinkBroken)`
  color: ${p => p.theme.tokens.content.secondary};
  flex-shrink: 0;
  transform: translateY(2px);
`;

const ToolCallBrokenLinkIconWrapper = styled('span')<{isLoading?: boolean}>`
  display: inline-flex;
  flex-shrink: 0;
  visibility: hidden;

  ${ToolCallPlainRow}:hover & {
    visibility: ${p => (p.isLoading ? 'hidden' : 'visible')};
  }
`;

const ActionBarWrapper = styled(Flex)`
  position: absolute;
  bottom: ${p => p.theme.space['2xs']};
  right: ${p => p.theme.space.md};
  white-space: nowrap;
  font-size: ${p => p.theme.font.size.sm};
  background: ${p => p.theme.tokens.background.primary};
  visibility: hidden;

  ${BlockWrapper}:hover &,
  ${BlockWrapper}:focus-within & {
    visibility: visible;
  }
`;

const UserBubble = styled('div')`
  max-width: 80%;
  padding: ${p => p.theme.space.xs} ${p => p.theme.space.md};
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-wrap: anywhere;
  min-width: 0;
  color: ${p => p.theme.tokens.content.primary};
  background: ${p => p.theme.tokens.background.secondary};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: 6px;
`;
