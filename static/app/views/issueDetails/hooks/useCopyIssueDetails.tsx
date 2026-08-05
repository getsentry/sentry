import {useCallback, useMemo, useSyncExternalStore} from 'react';
import moment from 'moment-timezone';

import {useHotkeys} from '@sentry/scraps/hotkey';

import {
  type ExplorerAutofixState,
  getAutofixArtifactFromSection,
  getOrderedAutofixSections,
  isRootCauseSection,
  isSolutionSection,
  useExplorerAutofix,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {artifactToMarkdown} from 'sentry/components/events/autofix/v3/utils';
import {NODE_ENV} from 'sentry/constants';
import {t} from 'sentry/locale';
import type {RawCrumb} from 'sentry/types/breadcrumbs';
import {EntryType, type Event, type EntryRequest} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {StacktraceType} from 'sentry/types/stacktrace';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getFormat, getUserTimezone} from 'sentry/utils/dates';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';
import {useOrganization} from 'sentry/utils/useOrganization';
import {formatSpanEvidenceToMarkdown} from 'sentry/views/issueDetails/hooks/spanEvidenceMarkdown';

// Simple store for active thread ID from the UI with subscription support
let _activeThreadId: number | undefined;
const _listeners = new Set<() => void>();

export function setActiveThreadId(threadId: number | undefined) {
  _activeThreadId = threadId;
  _listeners.forEach(listener => listener());
}

function getActiveThreadId() {
  return _activeThreadId;
}

export function useActiveThreadId() {
  return useSyncExternalStore(callback => {
    _listeners.add(callback);
    return () => _listeners.delete(callback);
  }, getActiveThreadId);
}

function formatStacktraceToMarkdown(stacktrace: StacktraceType): string {
  let markdownText = '#### Stacktrace\n\n';
  markdownText += '```\n';

  // Process frames (show at most 16 frames, similar to Python example)
  const maxFrames = 16;
  const frames = stacktrace.frames?.slice(-maxFrames) ?? [];

  // Display frames in reverse order (most recent call first)
  [...frames].reverse().forEach(frame => {
    const function_name = frame.function || 'Unknown function';
    const filename = frame.filename || 'unknown file';
    const lineInfo =
      frame.lineNo === undefined ? 'Line: Unknown' : `Line ${frame.lineNo}`;
    const inAppInfo = frame.inApp ? 'In app' : 'Not in app';

    markdownText += ` ${function_name} in ${filename} [${lineInfo}] (${inAppInfo})\n`;

    // Add context if available
    frame.context?.forEach((ctx: [number, string | null]) => {
      if (Array.isArray(ctx) && ctx.length >= 2) {
        const isSuspectLine = ctx[0] === frame.lineNo;
        markdownText += `${ctx[1]}${isSuspectLine ? '  <-- SUSPECT LINE' : ''}\n`;
      }
    });

    // Add variables if available
    if (frame.vars) {
      markdownText += '---\nVariable values:\n';
      markdownText += JSON.stringify(frame.vars, null, 2) + '\n';
      markdownText += '\n=======\n';
    }
  });

  markdownText += '```\n';
  return markdownText;
}

// Mirror Seer's breadcrumb handling: only the most recent crumbs are kept, any
// crumb whose message or data contains redacted (`[Filtered]`) content is
// skipped, and both the per-crumb and total output sizes are capped the same
// way so a pathological breadcrumb can't bloat the clipboard.
const MAX_BREADCRUMBS = 10;
const MAX_SINGLE_BREADCRUMB_CHARS = 500;
const MAX_BREADCRUMBS_CHARS = 5000;

function truncate(value: string, maxChars: number, suffix = '...'): string {
  return value.length > maxChars ? `${value.slice(0, maxChars)}${suffix}` : value;
}

function formatBreadcrumbsToMarkdown(crumbs: RawCrumb[]): string {
  const entries: string[] = [];

  crumbs.slice(-MAX_BREADCRUMBS).forEach(crumb => {
    const message = crumb.message ?? '';

    // Drop empty values, matching Seer's `{k: v for k, v in data if v}`.
    const data = crumb.data
      ? Object.fromEntries(Object.entries(crumb.data).filter(([, value]) => value))
      : null;
    const dataStr = data && Object.keys(data).length > 0 ? JSON.stringify(data) : '';

    if (message.includes('[Filtered]') || dataStr.includes('[Filtered]')) {
      return;
    }

    const type = crumb.type || 'default';
    const category = crumb.category ? ` \`${crumb.category}\`` : '';
    const level = crumb.level ? ` [${crumb.level}]` : '';

    // Seer caps the combined message + data per breadcrumb. Indent it under the
    // header line so multi-line content stays within the markdown list item.
    const content = truncate(
      [message, dataStr].filter(Boolean).join('\n'),
      MAX_SINGLE_BREADCRUMB_CHARS
    );

    const body = content
      ? content
          .split('\n')
          .map(line => `\n  ${line}`)
          .join('')
      : '';
    entries.push(`- **${type}**${category}${level}${body}`);
  });

  if (entries.length === 0) {
    return '';
  }

  const section = truncate(
    entries.join('\n'),
    MAX_BREADCRUMBS_CHARS,
    `\n... (breadcrumbs truncated to first ${MAX_BREADCRUMBS_CHARS.toLocaleString('en-US')} characters)`
  );

  return `\n## Breadcrumbs\n\n${section}\n`;
}

// Mirror Seer's request formatting: only the method, URL, and body are included
// (Seer deliberately omits cookies, headers, env, and query params), and the
// body is capped to keep an oversized payload off the clipboard. Scrubbed
// (`[Filtered]`) values are left in place — they're already redacted by Sentry
// and dropping the whole section would lose the method and URL.
const MAX_REQUEST_CHARS = 2000;

function formatRequestToMarkdown(data: EntryRequest['data']): string {
  const requestLine = [data.method, data.url].filter(Boolean).join(' ');

  const body = data.data;
  const hasBody = body !== null && body !== undefined && body !== '';
  const bodyStr = hasBody
    ? typeof body === 'string'
      ? body
      : JSON.stringify(body, null, 2)
    : '';

  if (!requestLine && !bodyStr) {
    return '';
  }

  let markdownText = '\n## Request\n\n';
  if (requestLine) {
    markdownText += `${requestLine}\n`;
  }
  if (bodyStr) {
    markdownText += `\nBody:\n\`\`\`\n${truncate(bodyStr, MAX_REQUEST_CHARS)}\n\`\`\`\n`;
  }

  return markdownText;
}

function formatEventToMarkdown(event: Event, activeThreadId: number | undefined): string {
  let markdownText = '';
  // Collected separately so breadcrumbs and the request always render after the
  // exception / thread sections, regardless of the order entries appear in.
  let breadcrumbsText = '';
  let requestText = '';

  // Add tags
  if (event && Array.isArray(event.tags) && event.tags.length > 0) {
    markdownText += '\n## Tags\n\n';
    event.tags.forEach(tag => {
      if (tag && typeof tag.key === 'string') {
        markdownText += `- **${tag.key}:** ${tag.value}\n`;
      }
    });
  }

  // Add exceptions
  event?.entries.forEach(entry => {
    if (entry.type === EntryType.EXCEPTION && entry.data.values) {
      markdownText += `\n## Exception${entry.data.values.length > 1 ? 's' : ''}\n\n`;

      entry.data.values.forEach((exception, index, arr) => {
        if (exception.type || exception.value) {
          markdownText += `### Exception ${index + 1}\n`;
          if (exception.type) {
            markdownText += `**Type:** ${exception.type}\n`;
          }
          // Mirror Seer's `is_exception_handled`: an unhandled exception crashed
          // the program, a handled one was caught. Only emit it when known.
          const handled = exception.mechanism?.handled;
          if (handled !== null && handled !== undefined) {
            markdownText += `**Handled:** ${handled ? 'Yes' : 'No'}\n`;
          }
          if (exception.value) {
            markdownText += `**Value:** ${exception.value}\n\n`;
          }

          // Add stacktrace if available
          if (exception.stacktrace?.frames && exception.stacktrace.frames.length > 0) {
            markdownText += formatStacktraceToMarkdown(exception.stacktrace);
            if (index < arr.length - 1) {
              markdownText += '------\n';
            }
          }
        }
      });
    } else if (entry.type === EntryType.THREADS && entry.data.values) {
      const threads = entry.data.values;
      // Use active thread from UI
      const activeThread = threads.find(thread => thread.id === activeThreadId);

      if (activeThread?.stacktrace) {
        markdownText += `\n## Thread: ${activeThread.name || ` Thread ${activeThread.id}`}`;
        if (activeThread.crashed) {
          markdownText += ' (crashed)';
        }
        if (activeThread.current) {
          markdownText += ' (current)';
        }
        markdownText += '\n\n';
        markdownText += formatStacktraceToMarkdown(activeThread.stacktrace);
      }
    } else if (entry.type === EntryType.BREADCRUMBS && entry.data.values) {
      breadcrumbsText += formatBreadcrumbsToMarkdown(entry.data.values);
    } else if (entry.type === EntryType.REQUEST && entry.data) {
      requestText += formatRequestToMarkdown(entry.data);
    }
  });

  markdownText += breadcrumbsText;
  markdownText += requestText;

  return markdownText;
}

interface IssueAndEventToMarkdownOptions {
  group: Group;
  organization: Organization;
  activeThreadId?: number;
  autofixData?: ExplorerAutofixState | null;
  event?: Event | null;
}

export const issueAndEventToMarkdown = ({
  group,
  event,
  autofixData,
  activeThreadId,
  organization,
}: IssueAndEventToMarkdownOptions): string => {
  // Format the basic issue information
  let markdownText = `# ${group.title}\n\n`;
  markdownText += `**Issue ID:** ${group.id}\n`;

  if (group.shortId) {
    markdownText += `**Short ID:** ${group.shortId}\n`;
  }

  if (group.project?.slug) {
    markdownText += `**Project:** ${group.project?.slug}\n`;
  }

  // In the detailed event payload, `dateCreated` is populated for error/default
  // events but not transactions (perf issues like N+1 DB). `dateReceived` is
  // present on every event, so fall back to it.
  const eventDate = event?.dateCreated ?? event?.dateReceived;
  if (typeof eventDate === 'string') {
    // Render in the viewer's preferred timezone and 12h/24h clock, and include
    // the timezone abbreviation so the timestamp is unambiguous once copied.
    const timezone =
      getUserTimezone() ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
    const formattedDate = moment
      .tz(eventDate, timezone)
      .format(getFormat({year: true, seconds: true, timeZone: true}));
    markdownText += `**Date:** ${formattedDate}\n`;
  }

  // Mirror Seer: include the event message only when it adds something beyond
  // the title, since for most errors the title already is the message.
  const message = event?.message?.trim();
  if (message && !group.title.includes(message)) {
    markdownText += `\n## Message\n\n${message}\n`;
  }

  if (autofixData) {
    const sections = getOrderedAutofixSections(autofixData);
    const rootCauseSection = sections.find(isRootCauseSection);
    const solutionSection = sections.find(isSolutionSection);

    const rootCauseArtifact = rootCauseSection
      ? getAutofixArtifactFromSection(rootCauseSection)
      : null;
    const solutionArtifact = solutionSection
      ? getAutofixArtifactFromSection(solutionSection)
      : null;

    const rootCauseCopyText = rootCauseArtifact
      ? artifactToMarkdown(rootCauseArtifact, 2)
      : null;
    const solutionCopyText = solutionArtifact
      ? artifactToMarkdown(solutionArtifact, 2)
      : null;

    if (rootCauseCopyText) {
      markdownText += `\n${rootCauseCopyText}\n`;
    }
    if (solutionCopyText) {
      markdownText += `\n${solutionCopyText}\n`;
    }
  }

  if (event) {
    markdownText += formatSpanEvidenceToMarkdown(event, organization, group);
    markdownText += formatEventToMarkdown(event, activeThreadId);
  }

  return markdownText;
};

export const useCopyIssueDetails = (group: Group, event?: Event) => {
  const organization = useOrganization();

  const {runState: autofixData} = useExplorerAutofix(group, {enabled: false});
  const activeThreadId = useActiveThreadId();

  const text = useMemo(() => {
    return issueAndEventToMarkdown({
      group,
      event,
      autofixData,
      activeThreadId,
      organization,
    });
  }, [group, event, autofixData, activeThreadId, organization]);

  const {copy} = useCopyToClipboard();

  const handleCopyIssueDetailsAsMarkdown = useCallback(() => {
    copy(text, {successMessage: t('Copied issue to clipboard as Markdown')}).then(() => {
      trackAnalytics('issue_details.copy_issue_details_as_markdown', {
        organization,
        groupId: group.id,
        eventId: event?.id,
        hasAutofix: Boolean(autofixData),
      });
    });
  }, [copy, text, organization, group.id, event?.id, autofixData]);

  useHotkeys([
    {
      match: 'mod+alt+c',
      callback: handleCopyIssueDetailsAsMarkdown,
      skipPreventDefault: NODE_ENV === 'development',
    },
  ]);
};
