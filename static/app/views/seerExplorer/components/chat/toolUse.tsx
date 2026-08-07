import {useMemo} from 'react';
import styled from '@emotion/styled';
import type {LocationDescriptor} from 'history';

import {Button} from '@sentry/scraps/button';
import {MessageRow, ToolCallIndicator, type ToolCallStatus} from '@sentry/scraps/chat';
import {Checkbox} from '@sentry/scraps/checkbox';
import {Disclosure} from '@sentry/scraps/disclosure';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {SeerMarkdown} from 'sentry/components/seer/markdown';
import {AgentWriteApprovalProvider} from 'sentry/components/seer/markdown/embeds/components/agentWriteApproval';
import {IconChevron, IconLink} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {
  callRecordDetail,
  callRecordFailure,
  callRecordLabel,
  callRecordUrl,
} from 'sentry/views/seerExplorer/callRecords';
import type {
  Block,
  CallRecord,
  TodoItem,
  ToolLink,
  ToolResult,
} from 'sentry/views/seerExplorer/types';
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
  pendingInput,
  readOnly = false,
  respondToUserInput,
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
        <AgentWriteApprovalProvider
          pendingInput={pendingInput ?? null}
          readOnly={readOnly}
          respondToUserInput={respondToUserInput}
        >
          {block.message.tool_calls ? (
            <ToolCallList
              block={block}
              blocks={blocks}
              getPageReferrer={getPageReferrer}
            />
          ) : null}
        </AgentWriteApprovalProvider>
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

  const structuredContentMarkdownByCallId = useMemo(() => {
    const map = new Map<string, ToolResult>();
    (block.tool_results || []).forEach(result => {
      if (
        result?.tool_call_id &&
        result.structuredContent &&
        result.content.trimStart().startsWith('{%')
      ) {
        map.set(result.tool_call_id, result);
      }
    });
    return map;
  }, [block.tool_results]);

  // The calls a Code Mode execute made (codemode-call-visibility). Keyed by tool_call_id like the
  // links bus: `sentry_api_execute` is one tool name for every action, so the rows come from what
  // the sandbox did rather than from the tool's name.
  const callRecordsByCallId = useMemo(() => {
    const map = new Map<string, CallRecord[]>();
    (block.tool_results || []).forEach(result => {
      const calls = result?.structuredContent?.calls;
      if (result?.tool_call_id && calls?.length) {
        map.set(result.tool_call_id, calls);
      }
    });
    return map;
  }, [block.tool_results]);

  // While an execute is still running there is no tool result yet, so seer mirrors its calls onto
  // the block itself. Those rows are what make a long run legible; they are replaced by the
  // per-result records above the moment the execute finishes.
  //
  // The mirror lives on the block, not per tool call, so it can only be attributed to a call that
  // has not reported yet. With several still in flight there is no way to tell whose calls these
  // are, so it is shown on none of them rather than duplicated across all.
  const liveCallsForCallId = useMemo(() => {
    const calls = block.live_calls ?? [];
    if (!calls.length) {
      return new Map<string, CallRecord[]>();
    }
    const finished = new Set(
      (block.tool_results ?? []).flatMap(result => result?.tool_call_id ?? [])
    );
    const pending = (block.message.tool_calls ?? []).flatMap(toolCall =>
      toolCall.id && !finished.has(toolCall.id) ? [toolCall.id] : []
    );

    return pending.length === 1
      ? new Map([[pending[0]!, calls]])
      : new Map<string, CallRecord[]>();
  }, [block.live_calls, block.tool_results, block.message.tool_calls]);

  return {
    sortedToolLinks,
    toolCallToLinkIndexMap,
    toolLinkByCallId,
    rawToolLinkByCallId,
    busLinksByCallId,
    structuredContentMarkdownByCallId,
    callRecordsByCallId,
    liveCallsForCallId,
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
    structuredContentMarkdownByCallId,
    callRecordsByCallId,
    liveCallsForCallId,
    organization,
    projects,
  } = useToolLinks(block);
  const toolsUsed = getToolsStringFromBlock(block);
  const blockStatus = getBlockStatus(block);
  const latestTodos = useMemo(() => findLatestTodos(blocks), [blocks]);

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

        // Render the checklist once per block, on the last tool-call row of whichever block holds
        // the newest snapshot — from either channel (codemode-structured-content-only).
        const isLastToolCall = idx === (block.message.tool_calls?.length ?? 0) - 1;
        const todos =
          isLastToolCall && latestTodos?.block === block ? latestTodos.todos : null;

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
            label: navLinkLabel(link.kind),
            url: buildToolLinkUrl(link, organization, projects),
          }))
          // Fail closed on both axes: drop a link we cannot build a URL for, and drop one we have
          // no label for rather than falling back to the raw kind. An unsupported kind already has
          // no URL builder, so the label check only bites if a builder is ever added without a
          // label — the coverage test keeps those two sets in step, and this is the backstop that
          // keeps an internal identifier off screen if it drifts anyway.
          .filter(
            (
              item
            ): item is {
              kind: string;
              label: string;
              url: NonNullable<typeof item.url>;
            } => !!item.url && !!item.label
          );
        const structuredContentMarkdown = toolCall.id
          ? structuredContentMarkdownByCallId.get(toolCall.id)
          : undefined;

        // A Code Mode execute reports the calls it made; those describe the work far better than
        // its single tool name can, so they replace the generic row when present. Until the result
        // lands the block's live mirror stands in, so a running execute shows its progress.
        const finishedCalls = toolCall.id
          ? (callRecordsByCallId.get(toolCall.id) ?? [])
          : [];
        const live = toolCall.id ? (liveCallsForCallId.get(toolCall.id) ?? []) : [];
        const callRows = (finishedCalls.length ? finishedCalls : live)
          .map(record => ({
            record,
            label: callRecordLabel(record),
            url: callRecordUrl(record, organization, projects),
          }))
          // A record we have no label for is dropped rather than rendered as a route or an
          // internal identifier — one fewer row beats a raw string on screen.
          .filter(
            (row): row is {label: string; record: CallRecord; url: typeof row.url} =>
              Boolean(row.label)
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
            structuredContentMarkdown={structuredContentMarkdown}
            onNavLinkClick={trackLinkClick}
            callRows={callRows}
            onCallLinkClick={trackLinkClick}
          />
        );
      })}
    </Stack>
  );
}

interface NavItem {
  kind: string;
  /** Resolved at construction, so an unlabeled kind never reaches the renderer. */
  label: string;
  url: NonNullable<ReturnType<typeof buildToolLinkUrl>>;
}

interface CallRow {
  /** Resolved at construction, so an unlabeled record never reaches the renderer. */
  label: string;
  record: CallRecord;
  url: LocationDescriptor | null;
}

function ToolCallRow({
  toolString,
  blockStatus,
  toolUrl,
  failureTooltip,
  onLinkClick,
  todos,
  navItems,
  structuredContentMarkdown,
  onNavLinkClick,
  callRows,
  onCallLinkClick,
}: {
  blockStatus: ToolCallStatus | undefined;
  failureTooltip: string | null;
  navItems: NavItem[];
  structuredContentMarkdown: ToolResult | undefined;
  todos: TodoItem[] | null;
  toolString: string;
  toolUrl: ReturnType<typeof buildToolLinkUrl>;
  callRows?: CallRow[];
  onCallLinkClick?: (kind: string) => (e: React.MouseEvent) => void;
  onLinkClick?: (e: React.MouseEvent) => void;
  onNavLinkClick?: (kind: string) => (e: React.MouseEvent) => void;
}) {
  const hasLink = toolUrl !== null;
  const hasCallRows = Boolean(callRows?.length);

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
        {/* Call records describe the work better than the tool's name, so they stand in for the
            generic row rather than sitting beneath it. The status indicator above still applies. */}
        {hasCallRows ? (
          <CallRows callRows={callRows!} onCallLinkClick={onCallLinkClick} />
        ) : hasLink ? (
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
      {/* Call records already name and link what the execute did, so the links bus for the same
          call is a duplicate — and a coarser one, since it links the tool rather than the call. */}
      {navItems.length > 0 && !hasCallRows && (
        <NavLinks navItems={navItems} onNavLinkClick={onNavLinkClick} />
      )}
      {todos && <TodoList todos={todos} />}
      {structuredContentMarkdown && (
        <SeerMarkdown
          raw={structuredContentMarkdown.content}
          structuredContent={structuredContentMarkdown.structuredContent}
        />
      )}
    </Stack>
  );
}

function CallRows({
  callRows,
  onCallLinkClick,
}: {
  callRows: CallRow[];
  onCallLinkClick?: (kind: string) => (e: React.MouseEvent) => void;
}) {
  return (
    <Stack as="ul" gap="xs" padding="0" minWidth={0}>
      {callRows.map(({record, label, url}) => {
        const failure = callRecordFailure(record);
        const text = (
          <Tooltip title={failure ?? ''} disabled={!failure}>
            <ToolCallText size="xs" variant="muted" monospace>
              {label}
            </ToolCallText>
          </Tooltip>
        );
        const row = url ? (
          <ToolCallLink to={url} onClick={onCallLinkClick?.(record.kind)}>
            {text}
            <ToolCallLinkIconWrapper>
              <ToolCallLinkIcon size="xs" />
            </ToolCallLinkIconWrapper>
          </ToolCallLink>
        ) : (
          <ToolCallPlainRow>{text}</ToolCallPlainRow>
        );

        const detail = callRecordDetail(record);

        // The row is the disclosure's own title, so the chevron sits inline with the label rather
        // than adding a second line beneath it. A row with nothing to show stays plain.
        return (
          <Stack key={record.id} as="li" gap="xs" minWidth={0}>
            {detail ? (
              <Disclosure size="sm">
                <Disclosure.Title>{row}</Disclosure.Title>
                <Disclosure.Content>
                  <CallDetail detail={detail} />
                </Disclosure.Content>
              </Disclosure>
            ) : (
              // Reserve the chevron's footprint with the chevron itself rather than guessing at
              // padding: it lives inside a Button, so its width is icon + button padding + icon
              // gap. Without this a non-expandable row starts further left than its siblings and
              // the column of labels comes apart.
              <Flex align="center">
                <ChevronSpacer aria-hidden>
                  <Button
                    size="sm"
                    variant="transparent"
                    aria-label=""
                    icon={<IconChevron direction="right" />}
                  />
                </ChevronSpacer>
                {row}
              </Flex>
            )}
          </Stack>
        );
      })}
    </Stack>
  );
}

/** What the row actually ran, and what came back. */
function CallDetail({
  detail,
}: {
  detail: NonNullable<ReturnType<typeof callRecordDetail>>;
}) {
  return (
    <Stack gap="xs" minWidth={0}>
      <Text size="xs" variant="muted" monospace>
        {detail.request}
      </Text>
      {detail.params.map(([key, value]) => (
        <Text key={key} size="xs" variant="muted" monospace>
          {key}={value}
        </Text>
      ))}
      {detail.body && <PayloadBox>{detail.body}</PayloadBox>}
    </Stack>
  );
}

// One entry per link kind buildToolLinkUrl can resolve. A kind absent here is not rendered at all
// (see navLinkLabel): showing the raw kind would leak an internal function name like
// `get_log_attributes` as the visible link text. Keeping this in step with buildToolLinkUrl's cases
// is enforced by a test, so a kind seer starts emitting cannot reach users unlabeled.
export const NAV_LINK_LABELS: Record<string, string> = {
  get_issue_details: t('View issue'),
  get_trace_waterfall: t('View trace'),
  get_replay_details: t('View replay'),
  get_profile_flamegraph: t('View profile'),
  get_event_details: t('View event'),
  get_log_attributes: t('View logs'),
  get_metric_attributes: t('View metrics'),
  // Dataset-dependent (issues / errors / spans / logs), so the label stays neutral.
  telemetry_live_search: t('View results'),
};

/** The visible label for a bus link, or undefined when the kind is not renderable. */
function navLinkLabel(kind: string): string | undefined {
  return NAV_LINK_LABELS[kind];
}

/**
 * The newest todo snapshot in the conversation and the block that carries it.
 *
 * A snapshot arrives on either channel: a classic `todo_write` writes `block.todos`, while Code Mode
 * returns it on a tool result's `structuredContent.todos`. Neither is converted into the other, so
 * both are walked in run order — blocks in sequence, and within a block its tool results in sequence,
 * with the legacy field first so a same-block collision resolves to the structured value. Returns
 * null when no block carries one.
 */
function findLatestTodos(blocks?: Block[]): {block: Block; todos: TodoItem[]} | null {
  let latest: {block: Block; todos: TodoItem[]} | null = null;
  for (const block of blocks ?? []) {
    if (block.todos?.length) {
      latest = {block, todos: block.todos};
    }
    for (const result of block.tool_results ?? []) {
      const todos = result?.structuredContent?.todos;
      if (todos?.length) {
        latest = {block, todos};
      }
    }
  }
  return latest;
}

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
              {item.label}
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
  /* Disclosure.Title renders its children inside a Button, which centres wrapped text. These rows
     read as a list, so a title long enough to wrap must stay left-aligned like its siblings. */
  text-align: left;
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

// Capped and scrollable rather than unbounded: the preview is already truncated server-side, but
// even 2KB of JSON would otherwise push the rest of the conversation off screen.
const PayloadBox = styled('pre')`
  margin: 0;
  padding: ${p => p.theme.space.md};
  max-height: 240px;
  overflow: auto;
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  background: ${p => p.theme.tokens.background.secondary};
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.xs};
  white-space: pre-wrap;
  word-break: break-word;
`;

// Holds the space a Disclosure's chevron occupies so a non-expandable row's label lines up with
// its expandable siblings. Built from the same Button the Disclosure uses rather than from padding
// tokens: the chevron sits inside a button whose icon gap is inherited, so the footprint cannot be
// reproduced by hand without drifting the moment button styling changes.
const ChevronSpacer = styled('span')`
  visibility: hidden;
  flex-shrink: 0;
  pointer-events: none;
`;

const ToolCallPlainRow = styled('span')`
  display: inline-flex;
  align-items: center;
  gap: ${p => p.theme.space.md};
  max-width: 100%;
`;
