import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';
import type {LocationDescriptor} from 'history';

import {MessageRow, ToolCallIndicator, type ToolCallStatus} from '@sentry/scraps/chat';
import {Checkbox} from '@sentry/scraps/checkbox';
import {CodeBlock} from '@sentry/scraps/code';
import {Disclosure} from '@sentry/scraps/disclosure';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {SeerMarkdown} from 'sentry/components/seer/markdown';
import {AgentWriteApprovalProvider} from 'sentry/components/seer/markdown/embeds/components/agentWriteApproval';
import {IconLink} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {
  callRecordDetail,
  callRecordFailure,
  callRecordLabel,
  callRecordStatus,
  visibleCallRecords,
} from 'sentry/views/seerExplorer/callRecords';
import {
  resolveLink,
  subjectFromCallRecord,
  subjectFromToolLink,
} from 'sentry/views/seerExplorer/links';
import type {
  Block,
  CallRecord,
  TodoItem,
  ToolLink,
  ToolResult,
} from 'sentry/views/seerExplorer/types';
import {
  getToolsStringFromBlock,
  getValidToolLinks,
} from 'sentry/views/seerExplorer/utils';

import type {ToolUseBlockProps} from './shared';
import {MessagePlaceholder, getBlockStatus, hasValidContent} from './shared';

// Result-status metadata rather than part of a link's identity: two entries pointing at the same
// target are the same link whether or not one side also reports the call failed or came back empty.
// Excluded from linkKey so the dedupe still matches a twin when only one channel carries them.
const LINK_STATUS_PARAMS = new Set(['is_error', 'empty_results']);

// Code Mode's tool names cover every action it can take, so "Used sentry_api_execute tool" names
// nothing. These rows are built from the calls the execute reported instead; the tool's own label
// is never rendered, and a call that produced nothing to show renders no row at all.
const CODE_MODE_TOOLS = new Set(['sentry_api_execute', 'sentry_api_search']);

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

  // Each row gets its own MessageRow rather than sharing one. A Code Mode execute makes several
  // api calls under a single tool call, but the reader has no notion of that grouping — an api
  // call is a thing that happened, exactly like a classic tool call, and packing several into one
  // row makes an execute that made three calls look different from three that made one each.
  return (
    <AgentWriteApprovalProvider
      pendingInput={pendingInput ?? null}
      readOnly={readOnly}
      respondToUserInput={respondToUserInput}
    >
      {showThinking && hasValidContent(block.message.thinking_content) && (
        <MessageRow from="assistant" density="compact">
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
        </MessageRow>
      )}
      {block.message.tool_calls ? (
        <ToolCallList block={block} blocks={blocks} getPageReferrer={getPageReferrer} />
      ) : null}
    </AgentWriteApprovalProvider>
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

  // The tool calls that have reported back. A result means the call returned, whatever it did or
  // did not carry, which is what tells a row whether anything is still in flight.
  const settledCallIds = useMemo(
    () =>
      new Set((block.tool_results ?? []).flatMap(result => result?.tool_call_id ?? [])),
    [block.tool_results]
  );

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
    const pending = (block.message.tool_calls ?? []).flatMap(toolCall =>
      toolCall.id && !settledCallIds.has(toolCall.id) ? [toolCall.id] : []
    );

    return pending.length === 1
      ? new Map([[pending[0]!, calls]])
      : new Map<string, CallRecord[]>();
  }, [block.live_calls, block.message.tool_calls, settledCallIds]);

  return {
    sortedToolLinks,
    toolCallToLinkIndexMap,
    toolLinkByCallId,
    rawToolLinkByCallId,
    busLinksByCallId,
    structuredContentMarkdownByCallId,
    callRecordsByCallId,
    liveCallsForCallId,
    settledCallIds,
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
    settledCallIds,
    organization,
    projects,
  } = useToolLinks(block);
  const toolsUsed = getToolsStringFromBlock(block);
  const blockStatus = getBlockStatus(block);
  const latestTodos = useMemo(() => findLatestTodos(blocks), [blocks]);

  // Counts rows actually rendered, so the status tick lands on the first visible one rather than
  // on a Code Mode call that was suppressed.
  let rendered = 0;

  // `flatMap` into one row per call, each in its own MessageRow. How the run partitioned work into
  // blocks and tool calls is invisible to the reader, so it must not show up as spacing: one
  // execute that made three calls has to look exactly like three that made one each.
  return (
    <Fragment>
      {block.message.tool_calls?.flatMap((toolCall, idx) => {
        const correspondingLinkIndex = toolCallToLinkIndexMap.get(idx);
        const toolLinkParams = toolCall.id
          ? toolLinkByCallId.get(toolCall.id)
          : undefined;
        const hasLink = correspondingLinkIndex !== undefined;
        const positionalLink = hasLink
          ? sortedToolLinks[correspondingLinkIndex]
          : undefined;
        const toolUrl = positionalLink
          ? (resolveLink(subjectFromToolLink(positionalLink), {organization, projects})
              ?.url ?? null)
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
          .flatMap(link => {
            // Fail closed: a kind no rule resolves, or one whose rule declines, renders nothing.
            // Label and destination arrive together from the rule, so a link can no longer show up
            // with an internal function name like `get_log_attributes` as its visible text.
            const resolved = resolveLink(subjectFromToolLink(link), {
              organization,
              projects,
            });
            return resolved
              ? [{kind: resolved.id, label: resolved.label, url: resolved.url}]
              : [];
          });
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
        // A result exists, so the execute returned and nothing it reported is still running. Read
        // off the result itself rather than off the records it carried: a call that reports none
        // has still finished, and reading "settled" as "reported something" would leave any row
        // built from the live mirror spinning.
        const callsAreSettled = toolCall.id ? settledCallIds.has(toolCall.id) : false;
        // Bus destinations already claimed by a call row (same rule id). A Code Mode execute often
        // emits both a call record and a coarser bus link for the same entity; without this, the
        // residual nav path would repeat "View issue" under a row that already navigates there.
        //
        // `telemetry_live_search` is the exception: many searches in one execute share that kind, so
        // claiming it wholesale would starve later rows of their bus twins. Those are paired one
        // bus link at a time below instead.
        const claimedLinkKinds = new Set<string>();
        const callRows = visibleCallRecords(finishedCalls.length ? finishedCalls : live)
          .map(record => {
            const link = resolveLink(subjectFromCallRecord(record), {
              organization,
              projects,
            });
            if (link && link.id !== 'telemetry_live_search') {
              claimedLinkKinds.add(link.id);
            }
            return {
              record,
              // A rule that matched names the row; seer's own title stands for every other call.
              label: link?.label ?? callRecordLabel(record),
              url: link?.url ?? null,
              // The rule that fired, not `record.kind` — analytics keys `tool_kind` on which
              // destination was opened, and the record's own kind is only ever api/lib.
              linkKind: link?.id ?? record.kind,
            };
          })
          // A record we have no label for is dropped rather than rendered as a route or an
          // internal identifier — one fewer row beats a raw string on screen. The predicate
          // narrows `label` for the render below, which is why it is not a plain Boolean check.
          .filter((row): row is typeof row & {label: string} => Boolean(row.label));

        const residualNavItems = navItems.filter(
          item => !claimedLinkKinds.has(item.kind)
        );
        // Telemetry rows need the bus one-for-one. The bus carries the authoritative translated
        // destination (query, project_slugs, stats_period); the call row carries the useful title.
        // Always take the bus url when pairing — a stamped row may already resolve from query alone
        // and miss project filters the bus still has. Consume the twin either way so "View …" is
        // not repeated under a row that already navigates there. Order is preserved so N searches
        // pair with N bus links without starving siblings.
        const linkedCallRows = callRows.map(row => {
          if (row.record.name !== 'telemetry_live_search') {
            return row;
          }
          const navItemIndex = residualNavItems.findIndex(
            item => item.kind === 'telemetry_live_search'
          );
          if (navItemIndex === -1) {
            return row;
          }
          const [navItem] = residualNavItems.splice(navItemIndex, 1);
          if (!navItem) {
            return row;
          }
          return {...row, url: navItem.url, linkKind: navItem.kind};
        });

        const isCodeMode = CODE_MODE_TOOLS.has(toolCall.function);
        const toolString = isCodeMode ? '' : (toolsUsed[idx] ?? '');

        // Nothing to say: a Code Mode call whose label is suppressed and which reported no calls,
        // todos, links or markdown would render an empty row with a lone status tick.
        // Use residual nav items, not the pre-pairing list: consumed destinations no longer render.
        const hasContent =
          Boolean(toolString) ||
          linkedCallRows.length > 0 ||
          residualNavItems.length > 0 ||
          Boolean(todos) ||
          Boolean(structuredContentMarkdown);
        if (!hasContent) {
          return [];
        }
        const key = toolCall.id ?? `${toolCall.function}-${idx}`;

        // Both sources normalize to the same row shape. A classic tool contributes one row for
        // itself; a Code Mode call contributes one per api call it made.
        const rows: React.ReactNode[] = linkedCallRows.length
          ? linkedCallRows.map(({record, label, url, linkKind}) => (
              <CallRow
                key={`${key}-${record.id}`}
                row={{
                  label,
                  url,
                  failure: callRecordFailure(record),
                  status: callRecordStatus(record, callsAreSettled),
                  detail: callRecordDetail(record),
                }}
                onLinkClick={trackLinkClick(linkKind)}
              />
            ))
          : toolString
            ? [
                <CallRow
                  key={key}
                  row={{
                    label: toolString,
                    url: toolUrl,
                    failure: failureTooltip,
                    // Only the first classic row shows the block status; call rows carry their own.
                    status: ++rendered === 1 ? blockStatus : undefined,
                    detail: null,
                  }}
                  onLinkClick={handleLinkClick}
                />,
              ]
            : // A Code Mode call has no label of its own, so with no call rows there is nothing to
              // put in a row — `hasContent` got us here for the trailing surfaces (todos, markdown,
              // links), and rendering the empty label anyway is the lone status tick that guard
              // exists to avoid.
              [];

        // Trailing per-tool-call surfaces. These belong to the call as a whole rather than to any
        // one row, so they follow its rows rather than sitting inside one.
        //
        // Residual bus links only — destinations already claimed by or paired with a call row were
        // filtered out above. Any links that do not describe a visible call still render here.
        if (residualNavItems.length > 0) {
          rows.push(
            <NavLinks
              key={`${key}-links`}
              navItems={residualNavItems}
              onNavLinkClick={trackLinkClick}
            />
          );
        }
        if (structuredContentMarkdown) {
          rows.push(
            <SeerMarkdown
              key={`${key}-markdown`}
              raw={structuredContentMarkdown.content}
              structuredContent={structuredContentMarkdown.structuredContent}
            />
          );
        }
        if (todos) {
          rows.push(<TodoList key={`${key}-todos`} todos={todos} />);
        }
        return rows.map((row, rowIdx) => (
          <MessageRow key={`${key}-row-${rowIdx}`} from="assistant" density="compact">
            {row}
          </MessageRow>
        ));
      })}
    </Fragment>
  );
}

interface NavItem {
  /** The rule that resolved the link, for analytics. */
  kind: string;
  /** Resolved at construction, so an unlabeled kind never reaches the renderer. */
  label: string;
  url: LocationDescriptor;
}

/** A row to render, normalized from either a classic tool call or one api call. */
interface RenderRow {
  /** The request behind the row, when it has one to expand. */
  detail: ReturnType<typeof callRecordDetail>;
  failure: string | null;
  /** Resolved at construction, so an unlabeled row never reaches the renderer. */
  label: string;
  status: ToolCallStatus | undefined;
  url: LocationDescriptor | null;
}

/**
 * One row in the list — a classic tool call or a single Sentry API call, rendered identically.
 *
 * An api call *is* a tool call as far as the reader is concerned: something happened, it succeeded
 * or it did not, and it may point somewhere. Giving the two shapes separate components let their
 * spacing and alignment drift apart, so they share one.
 */
function CallRow({
  row,
  onLinkClick,
}: {
  row: RenderRow;
  onLinkClick?: (e: React.MouseEvent) => void;
}) {
  const text = (
    <Tooltip title={row.failure ?? ''} disabled={!row.failure}>
      <ToolCallText size="xs" variant="muted" monospace>
        {row.label}
      </ToolCallText>
    </Tooltip>
  );
  const label = row.url ? (
    <ToolCallLink to={row.url} onClick={onLinkClick}>
      {text}
      <ToolCallLinkIconWrapper>
        <ToolCallLinkIcon size="xs" />
      </ToolCallLinkIconWrapper>
    </ToolCallLink>
  ) : (
    <ToolCallPlainRow>{text}</ToolCallPlainRow>
  );

  return (
    // Matches the block-level indicator's box so a call row's tick sits on the same vertical
    // rhythm.
    <Flex gap="sm" align="center" minWidth={0} maxWidth="100%">
      {/* One tick per row: a lib helper that fans out into three requests is three separate
          outcomes, and a single tick above the group could not say which of them failed. */}
      <Flex align="center" justify="center" width="12px" height="12px" flexShrink={0}>
        {row.status && <ToolCallIndicator status={row.status} />}
      </Flex>
      {row.detail ? (
        // The title is the disclosure's own, so the chevron sits inline with it rather than adding
        // a second line beneath. The link cannot go inside it: the title renders as a button, and
        // an anchor nested in a button is invalid HTML that leaves both controls sharing one click
        // target and one tab stop. `trailingItems` puts it beside the button instead — the title
        // expands the request, the icon navigates.
        <Disclosure size="xs">
          <Disclosure.Title
            trailingItems={
              row.url && <RowLink url={row.url} label={row.label} onClick={onLinkClick} />
            }
          >
            {text}
          </Disclosure.Title>
          <Disclosure.Content>
            <CallDetail detail={row.detail} />
          </Disclosure.Content>
        </Disclosure>
      ) : (
        <Flex align="center" minWidth={0}>
          {label}
        </Flex>
      )}
    </Flex>
  );
}

/**
 * The row's destination as a control of its own, for a row that also expands.
 *
 * Visible at rest, unlike the inline variant whose icon the label's hover reveals: there is no
 * label to hover here, and an affordance that only appears under the pointer is one a keyboard
 * user never finds.
 */
function RowLink({
  url,
  label,
  onClick,
}: {
  label: string;
  url: LocationDescriptor;
  onClick?: (e: React.MouseEvent) => void;
}) {
  return (
    <ToolCallLink to={url} onClick={onClick} aria-label={t('Open %s', label)}>
      <ToolCallLinkIcon size="xs" />
    </ToolCallLink>
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
      {detail.body && <CodeBlock language="json">{detail.body}</CodeBlock>}
    </Stack>
  );
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

const ToolCallPlainRow = styled('span')`
  display: inline-flex;
  align-items: center;
  gap: ${p => p.theme.space.md};
  max-width: 100%;
`;
