import {useMemo} from 'react';
import {useHover} from '@react-aria/interactions';
import {IconChevron} from '@sentry/icons/chevron';
import {IconCopy} from '@sentry/icons/copy';
import {useQueryClient} from '@tanstack/react-query';

import {Button, ButtonBar} from '@sentry/scraps/button';
import {DropdownMenu} from '@sentry/scraps/dropdownMenu';

import {addMessage} from 'sentry/actionCreators/indicator';
import type {useExplorerAutofix} from 'sentry/components/events/autofix/useExplorerAutofix';
import {PluginIcon} from 'sentry/icons/pluginIcon';
import {t, tct} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';
import {useOrganization} from 'sentry/utils/useOrganization';
import {issueAndEventToMarkdown} from 'sentry/views/issueDetails/hooks/useCopyIssueDetails';
import {useEventQuery} from 'sentry/views/issueDetails/hooks/useEventQuery';
import {
  groupEventApiOptions,
  useDefaultIssueEvent,
  useEnvironmentsFromUrl,
} from 'sentry/views/issueDetails/utils';
import {buildAgentPrompt} from 'sentry/views/issueList/pages/inbox/issuePreview/agentPrompt';

const TRUNCATION_NOTICE = '\n\n_[truncated to fit this editor’s deeplink limit]_';

interface CodingAgentTarget {
  /**
   * Everything up to the query string. Each target registers its own scheme
   * with the OS, so a link only resolves on a machine where that tool is
   * installed — an unregistered scheme is a silent no-op.
   */
  base: string;
  key: string;
  label: string;
  /** Plugin logo id for the menu item. Claude targets share one brand mark. */
  pluginId: string;
  /** Query parameter that carries the prefilled prompt. Differs per target. */
  promptParam: string;
  /** Documented cap on the decoded prompt text, where the target states one. */
  maxPromptChars?: number;
  /** Documented cap on the whole encoded URL, where the target states one. */
  maxUrlChars?: number;
}

/**
 * Deeplink shapes are verified against each tool's own docs; the limits differ
 * per target, so they are declared rather than assumed to be uniform.
 *
 * - Cursor: https://cursor.com/docs/integrations/deeplinks (8,000 char URL)
 * - Claude Code: https://code.claude.com/docs/en/deep-links (5,000 char `q`)
 * - Claude Desktop: https://support.claude.com/en/articles/14729294 (~14,000 char `q`)
 */
const CODING_AGENT_TARGETS: CodingAgentTarget[] = [
  {
    key: 'cursor',
    label: t('Cursor'),
    base: 'cursor://anysphere.cursor-deeplink/prompt',
    pluginId: 'cursor',
    promptParam: 'text',
    maxUrlChars: 8000,
  },
  {
    key: 'claude-code',
    label: t('Claude Code'),
    base: 'claude-cli://open',
    pluginId: 'claude_code',
    promptParam: 'q',
    maxPromptChars: 5000,
  },
  {
    key: 'claude-desktop',
    label: t('Claude Desktop'),
    base: 'claude://code/new',
    pluginId: 'claude_code',
    promptParam: 'q',
    maxPromptChars: 14000,
  },
];

/**
 * Trims to `length` without splitting a surrogate pair. Issue titles carry user
 * content, so an emoji can straddle the cut, and `encodeURIComponent` throws on
 * the lone surrogate that would leave behind.
 */
function trimToLength(text: string, length: number): string {
  const sliced = text.slice(0, length);
  const lastCharCode = sliced.charCodeAt(sliced.length - 1);
  const endsOnHighSurrogate = lastCharCode >= 0xd800 && lastCharCode <= 0xdbff;
  return endsOnHighSurrogate ? sliced.slice(0, -1) : sliced;
}

function buildUrl(target: CodingAgentTarget, prompt: string): string {
  // Manual encoding rather than URLSearchParams: the latter form-encodes
  // spaces as `+`, and Cursor in particular mis-parses the result.
  return `${target.base}?${target.promptParam}=${encodeURIComponent(prompt)}`;
}

function fitsWithinLimits(target: CodingAgentTarget, prompt: string): boolean {
  if (target.maxPromptChars !== undefined && prompt.length > target.maxPromptChars) {
    return false;
  }
  if (
    target.maxUrlChars !== undefined &&
    buildUrl(target, prompt).length > target.maxUrlChars
  ) {
    return false;
  }
  return true;
}

/**
 * Packs the issue markdown into a prompt deeplink, trimming the tail when the
 * target would reject or silently cut the payload. Seer's root cause and
 * solution sections routinely push past the tighter limits, so trimming is the
 * common path rather than an edge case.
 */
export function buildAgentPromptUrl(
  target: CodingAgentTarget,
  markdown: string
): {truncated: boolean; url: string} {
  if (fitsWithinLimits(target, markdown)) {
    return {url: buildUrl(target, markdown), truncated: false};
  }

  // Percent-encoding inflates by a content-dependent factor, so search over the
  // raw text and re-measure rather than slicing the encoded string (which would
  // risk cutting a `%xx` escape in half). Encoded length grows monotonically
  // with the prefix, so binary search finds the longest prefix that still fits
  // — stepwise shrinking left 4-7% of these already-small budgets unused.
  let shortest = 0;
  let longest = markdown.length;
  while (shortest < longest) {
    const candidate = Math.ceil((shortest + longest) / 2);
    if (
      fitsWithinLimits(target, `${trimToLength(markdown, candidate)}${TRUNCATION_NOTICE}`)
    ) {
      shortest = candidate;
    } else {
      longest = candidate - 1;
    }
  }

  const text = trimToLength(markdown, shortest);
  return {url: buildUrl(target, `${text}${TRUNCATION_NOTICE}`), truncated: true};
}

/**
 * Copies the previewed issue as markdown, or hands the same markdown to a
 * coding agent as a prefilled prompt.
 *
 * Both payloads need the issue's event — without one the builders emit only the
 * title and IDs, with no stacktrace, breadcrumbs, request data, or tags. That
 * request is expensive (`llmFormat=markdown` makes the server render the whole
 * issue), so it is warmed on hover and resolved on click rather than fired for
 * every issue the user clicks through in the inbox.
 */
export function CopyIssueMarkdownButton({
  autofix,
  group,
}: {
  autofix: ReturnType<typeof useExplorerAutofix>;
  group: Group;
}) {
  const organization = useOrganization();
  const {copy} = useCopyToClipboard();
  const queryClient = useQueryClient();
  const environments = useEnvironmentsFromUrl();
  const eventQuery = useEventQuery();
  const defaultIssueEvent = useDefaultIssueEvent();

  // Same options factory `useGroupEvent` uses, so the key matches and the hover
  // prefetch, the click, and issue details all share one cache entry.
  const eventOptions = useMemo(
    () =>
      groupEventApiOptions({
        orgSlug: organization.slug,
        groupId: group.id,
        eventId: defaultIssueEvent,
        environments,
        query: eventQuery,
      }),
    [organization.slug, group.id, defaultIssueEvent, environments, eventQuery]
  );

  // Warm the cache on hover so the click below almost always runs synchronously.
  // This is invisible: no spinner, and nothing is disabled while it runs.
  const {hoverProps} = useHover({
    onHoverStart: () => void queryClient.prefetchQuery(eventOptions),
  });

  /**
   * Runs `action` with the event, synchronously when the prefetch already
   * landed. That matters for the clipboard: awaiting a cold network request
   * first can lose the user-activation the Clipboard API requires in Safari.
   */
  const withEvent = (action: (event: Event | undefined) => void) => {
    const cached = queryClient.getQueryData(eventOptions.queryKey);
    if (cached) {
      action(cached.json);
      return;
    }
    queryClient
      .ensureQueryData(eventOptions)
      .then(response => action(response.json))
      // A failed event fetch still leaves a useful issue-level payload.
      .catch(() => action(undefined));
  };

  const copyAsMarkdown = () =>
    withEvent(event =>
      copy(
        issueAndEventToMarkdown({
          group,
          event,
          organization,
          autofixData: autofix.runState,
          autofixFormatted: autofix.autofixFormatted,
        }),
        {successMessage: t('Copied issue to clipboard as Markdown')}
      )
    );

  const openInAgent = (target: CodingAgentTarget) =>
    withEvent(event => {
      // Deliberately not the copy payload: the clipboard takes the whole issue,
      // but a deeplink gets a selected extract plus a permalink for the rest.
      const prompt = buildAgentPrompt({group, event, autofixData: autofix.runState});
      const {url, truncated} = buildAgentPromptUrl(target, prompt);
      if (truncated) {
        addMessage(
          tct('Issue was trimmed to fit [label]’s prompt limit', {label: target.label}),
          'error'
        );
      }
      // A scheme with no registered handler does nothing, so the page stays put.
      window.location.href = url;
    });

  return (
    <ButtonBar
      {...hoverProps}
      onFocus={() => void queryClient.prefetchQuery(eventOptions)}
    >
      <Button size="xs" icon={<IconCopy size="xs" />} onClick={copyAsMarkdown}>
        {t('Copy as Markdown')}
      </Button>
      <DropdownMenu
        position="bottom-end"
        size="sm"
        minMenuWidth={220}
        trigger={(triggerProps, isOpen) => (
          <Button
            {...triggerProps}
            size="xs"
            aria-label={t('Open issue in a coding agent')}
            icon={
              <IconChevron variant="muted" direction={isOpen ? 'up' : 'down'} size="xs" />
            }
          />
        )}
        items={[
          {
            key: 'open-in',
            label: t('Open in'),
            children: CODING_AGENT_TARGETS.map(target => ({
              key: target.key,
              label: target.label,
              leadingItems: <PluginIcon pluginId={target.pluginId} size={16} />,
              onAction: () => openInAgent(target),
            })),
          },
        ]}
      />
    </ButtonBar>
  );
}
