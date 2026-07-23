import {useMemo} from 'react';
import styled from '@emotion/styled';

import {ToolCallIndicator, type ToolCallStatus} from '@sentry/scraps/chat';
import {Checkbox} from '@sentry/scraps/checkbox';
import {Disclosure} from '@sentry/scraps/disclosure';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {SeerMarkdown} from 'sentry/components/seer/markdown';
import {IconLink} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import type {Block, TodoItem} from 'sentry/views/seerExplorer/types';
import {
  buildToolLinkUrl,
  getToolsStringFromBlock,
  getValidToolLinks,
} from 'sentry/views/seerExplorer/utils';

import type {ToolUseBlockProps} from './shared';
import {MessagePlaceholder, getBlockStatus, hasValidContent} from './shared';

export function ToolUseBlock({
  block,
  showThinking,
  blocks,
  getPageReferrer,
}: ToolUseBlockProps) {
  if (block.loading && !block.message.tool_calls) {
    return <MessagePlaceholder />;
  }

  return (
    <Stack padding="md xl" gap="md" minWidth={0} overflow="hidden">
      {showThinking && hasValidContent(block.message.thinking_content) && (
        <Disclosure size="sm">
          <Disclosure.Title>
            <Text size="sm" variant="muted" monospace>
              {t('Thinking')}
            </Text>
          </Disclosure.Title>
          <Disclosure.Content>
            <SeerMarkdown raw={block.message.thinking_content} />
          </Disclosure.Content>
        </Disclosure>
      )}
      {block.message.tool_calls ? (
        <ToolCallList block={block} blocks={blocks} getPageReferrer={getPageReferrer} />
      ) : null}
    </Stack>
  );
}

function useToolLinks(block: Block) {
  const organization = useOrganization();
  const {projects} = useProjects();

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

interface ToolCallListProps {
  block: Block;
  blocks?: Block[];
  getPageReferrer?: () => string;
}

function ToolCallList({block, blocks, getPageReferrer}: ToolCallListProps) {
  const {
    sortedToolLinks,
    toolCallToLinkIndexMap,
    toolLinkByCallId,
    organization,
    projects,
  } = useToolLinks(block);
  const toolsUsed = getToolsStringFromBlock(block);
  const blockStatus = getBlockStatus(block);

  return (
    <Stack gap="md" width="100%" minWidth={0} paddingRight="lg">
      {block.message.tool_calls?.map((toolCall, idx) => {
        const correspondingLinkIndex = toolCallToLinkIndexMap.get(idx);
        const toolLinkParams = toolCall.id
          ? toolLinkByCallId.get(toolCall.id)
          : undefined;
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
          isTodoWrite &&
          block.todos?.length &&
          blocks?.findLast(b => b.todos?.length) === block
            ? block.todos
            : null;

        const failureTooltip = toolLinkParams?.is_error
          ? t('Tool call failed')
          : toolLinkParams?.empty_results
            ? t('Tool call returned empty results')
            : null;

        return (
          <ToolCallRow
            key={toolCall.id ?? `${toolCall.function}-${idx}`}
            toolString={toolsUsed[idx] ?? ''}
            blockStatus={idx === 0 ? blockStatus : undefined}
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
  blockStatus,
  toolUrl,
  failureTooltip,
  onLinkClick,
  todos,
}: {
  blockStatus: ToolCallStatus | undefined;
  failureTooltip: string | null;
  todos: TodoItem[] | null;
  toolString: string;
  toolUrl: ReturnType<typeof buildToolLinkUrl>;
  onLinkClick?: (e: React.MouseEvent) => void;
}) {
  const hasLink = toolUrl !== null;

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
          style={{transform: 'translateY(0.15em)'}}
        >
          {blockStatus && <ToolCallIndicator status={blockStatus} />}
        </Flex>
        {hasLink ? (
          <ToolCallLink to={toolUrl} onClick={onLinkClick}>
            {toolCallText}
            <ToolCallLinkIconWrapper>
              <ToolCallLinkIcon size="xs" />
            </ToolCallLinkIconWrapper>
          </ToolCallLink>
        ) : (
          <ToolCallPlainRow>{toolCallText}</ToolCallPlainRow>
        )}
      </Flex>
      {todos && <TodoList todos={todos} />}
    </Stack>
  );
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
