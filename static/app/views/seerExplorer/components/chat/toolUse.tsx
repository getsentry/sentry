import {useMemo} from 'react';
import styled from '@emotion/styled';

import {MessageRow, ToolCallIndicator, type ToolCallStatus} from '@sentry/scraps/chat';
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
import type {Block, TodoItem, ToolLink} from 'sentry/views/seerExplorer/types';
import {
  buildToolLinkUrl,
  getToolsStringFromBlock,
  getValidToolLinks,
} from 'sentry/views/seerExplorer/utils';

import type {ToolUseBlockProps} from './shared';
import {MessagePlaceholder, getBlockStatus, hasValidContent} from './shared';

// Result-status metadata rather than part of a link's identity: two entries pointing at the same
// target are the same link whether or not one side also reports the call failed or came back empty.
// Excluded from linkKey so the dedupe still matches a twin when only one channel carries them.
const LINK_STATUS_PARAMS = new Set(['is_error', 'empty_results']);

// Identity for deduping a bus link against the positional row link. Params are sorted so the key
// does not depend on object key order — today both channels derive params from the same object, but
// this keeps the dedupe correct if that ever stops being true.
function linkKey(link: ToolLink) {
  const params = link.params ?? {};
  const sorted = Object.keys(params)
    .filter(k => !LINK_STATUS_PARAMS.has(k))
    .sort()
    .map(k => `${k}=${JSON.stringify(params[k])}`)
    .join(',');
  return `${link.kind}:${sorted}`;
}

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
    <MessageRow from="assistant" density="compact">
      <Stack gap="md" width="100%" minWidth={0} overflow="hidden">
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
    </MessageRow>
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

  // The positional links as seer sent them, before getValidToolLinks drops errored/unbuildable
  // ones. Used only to dedupe the bus against the positional channel: an errored link still has to
  // suppress its bus twin even though it never renders as a row link itself.
  const rawToolLinkByCallId = useMemo(() => {
    const map = new Map<string, ToolLink>();
    (block.tool_results || []).forEach((result, idx) => {
      const link = block.tool_links?.[idx];
      if (result?.tool_call_id && link) {
        map.set(result.tool_call_id, link);
      }
    });
    return map;
  }, [block.tool_links, block.tool_results]);

  // The links bus (code-mode-effects-registry): a tool result carries its own deep-links in
  // structuredContent.links as a {kind, params} list. Keyed by tool_call_id, so a result can hold
  // many with no index alignment. When present, this is the source of truth for that result's
  // links; when absent, we fall back to the positional block.tool_links below.
  const busLinksByCallId = useMemo(() => {
    const map = new Map<string, ToolLink[]>();
    (block.tool_results || []).forEach(result => {
      const links = result?.structuredContent?.links;
      if (result?.tool_call_id && links?.length) {
        map.set(result.tool_call_id, links);
      }
    });
    return map;
  }, [block.tool_results]);

  return {
    sortedToolLinks,
    toolCallToLinkIndexMap,
    toolLinkByCallId,
    rawToolLinkByCallId,
    busLinksByCallId,
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
    rawToolLinkByCallId,
    busLinksByCallId,
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
        const positionalLink = hasLink
          ? sortedToolLinks[correspondingLinkIndex]
          : undefined;
        const toolUrl = positionalLink
          ? buildToolLinkUrl(positionalLink, organization, projects)
          : null;

        // Both channels' links stop propagation (so the click doesn't reach the blocks
        // container's handler) and report the same navigation analytics.
        const trackLinkClick = (kind: string) => (e: React.MouseEvent) => {
          e.stopPropagation();
          trackAnalytics('seer.explorer.global_panel.tool_link_navigation', {
            referrer: getPageReferrer?.() ?? '',
            organization,
            tool_kind: kind,
          });
        };

        const handleLinkClick = positionalLink
          ? trackLinkClick(positionalLink.kind)
          : undefined;

        // Render the checklist once per block (on the last tool-call row), regardless of
        // which tool produced it — classic `todo_write` or Code Mode `sentry_api_execute`,
        // which projects its todos onto block.todos (code-mode-effects-bus).
        const isLastToolCall = idx === (block.message.tool_calls?.length ?? 0) - 1;
        const todos =
          isLastToolCall &&
          block.todos?.length &&
          blocks?.findLast(b => b.todos?.length) === block
            ? block.todos
            : null;

        const failureTooltip = toolLinkParams?.is_error
          ? t('Tool call failed')
          : toolLinkParams?.empty_results
            ? t('Tool call returned empty results')
            : null;

        // Links bus: render the result's own links (structuredContent.links) as labeled links
        // below the row. Dedupe the one already shown as the positional row link (classic tools
        // populate both channels during migration), so a Code Mode execute's many links surface
        // while classic single-link rendering is unchanged. Errored links are dropped here for
        // the same reason getValidToolLinks drops them from the positional channel.
        //
        // Dedupe against the *raw* positional link, not the filtered `positionalLink`:
        // getValidToolLinks drops errored (and unbuildable) links, so a failed classic tool has no
        // `positionalLink` at all. Keying off that would leave its bus twin unmatched and render it
        // as a success link under a row that failed.
        const rawPositionalLink = toolCall.id
          ? rawToolLinkByCallId.get(toolCall.id)
          : undefined;
        const positionalKey = rawPositionalLink ? linkKey(rawPositionalLink) : null;
        const navItems = (toolCall.id ? (busLinksByCallId.get(toolCall.id) ?? []) : [])
          .filter(link => link.params?.is_error !== true)
          .filter(link => linkKey(link) !== positionalKey)
          .map(link => ({
            kind: link.kind,
            url: buildToolLinkUrl(link, organization, projects),
          }))
          .filter(
            (item): item is {kind: string; url: NonNullable<typeof item.url>} =>
              !!item.url
          );

        return (
          <ToolCallRow
            key={toolCall.id ?? `${toolCall.function}-${idx}`}
            toolString={toolsUsed[idx] ?? ''}
            blockStatus={idx === 0 ? blockStatus : undefined}
            toolUrl={toolUrl}
            failureTooltip={failureTooltip}
            onLinkClick={handleLinkClick}
            todos={todos}
            navItems={navItems}
            onNavLinkClick={trackLinkClick}
          />
        );
      })}
    </Stack>
  );
}

interface NavItem {
  kind: string;
  url: NonNullable<ReturnType<typeof buildToolLinkUrl>>;
}

function ToolCallRow({
  toolString,
  blockStatus,
  toolUrl,
  failureTooltip,
  onLinkClick,
  todos,
  navItems,
  onNavLinkClick,
}: {
  blockStatus: ToolCallStatus | undefined;
  failureTooltip: string | null;
  navItems: NavItem[];
  todos: TodoItem[] | null;
  toolString: string;
  toolUrl: ReturnType<typeof buildToolLinkUrl>;
  onLinkClick?: (e: React.MouseEvent) => void;
  onNavLinkClick?: (kind: string) => (e: React.MouseEvent) => void;
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
      {navItems.length > 0 && (
        <NavLinks navItems={navItems} onNavLinkClick={onNavLinkClick} />
      )}
      {todos && <TodoList todos={todos} />}
    </Stack>
  );
}

const NAV_LINK_LABELS: Record<string, string> = {
  get_issue_details: t('View issue'),
  get_trace_waterfall: t('View trace'),
  get_replay_details: t('View replay'),
  get_profile_flamegraph: t('View profile'),
};

function NavLinks({
  navItems,
  onNavLinkClick,
}: {
  navItems: NavItem[];
  onNavLinkClick?: (kind: string) => (e: React.MouseEvent) => void;
}) {
  return (
    <Stack as="ul" gap="xs" padding="0">
      {navItems.map((item, idx) => (
        <Flex key={`${item.kind}-${idx}`} as="li" gap="sm" align="center">
          {/* ToolCallText (not plain Text) so ToolCallLink's hover rule, which targets it by
              class, colors the label the same way it does the positional row link. */}
          <ToolCallLink to={item.url} onClick={onNavLinkClick?.(item.kind)}>
            <ToolCallText size="xs" monospace>
              {NAV_LINK_LABELS[item.kind] ?? item.kind}
            </ToolCallText>
            <ToolCallLinkIconWrapper>
              <ToolCallLinkIcon size="xs" />
            </ToolCallLinkIconWrapper>
          </ToolCallLink>
        </Flex>
      ))}
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
