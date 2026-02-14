import {useCallback, useMemo, useSyncExternalStore} from 'react';

import type {AutofixData} from 'sentry/components/events/autofix/types';
import {useAutofixData} from 'sentry/components/events/autofix/useAutofix';
import {
  getRootCauseCopyText,
  getSolutionCopyText,
} from 'sentry/components/events/autofix/utils';
import {
  useGroupSummaryData,
  type GroupSummaryData,
} from 'sentry/components/group/groupSummary';
import {NODE_ENV} from 'sentry/constants';
import {t} from 'sentry/locale';
import {EntryType, type Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {StacktraceType} from 'sentry/types/stacktrace';
import {trackAnalytics} from 'sentry/utils/analytics';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';
import {useHotkeys} from 'sentry/utils/useHotkeys';
import useOrganization from 'sentry/utils/useOrganization';

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
  let markdownText = `#### Stacktrace\n\n`;
  markdownText += `\`\`\`\n`;

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
      markdownText += `---\nVariable values:\n`;
      markdownText += JSON.stringify(frame.vars, null, 2) + '\n';
      markdownText += `\n=======\n`;
    }
  });

  markdownText += `\`\`\`\n`;
  return markdownText;
}

export function formatEventToMarkdown(
  event: Event,
  activeThreadId: number | undefined
): string {
  let markdownText = '';

  // Add tags
  if (event && Array.isArray(event.tags) && event.tags.length > 0) {
    markdownText += `\n## Tags\n\n`;
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
          if (exception.value) {
            markdownText += `**Value:** ${exception.value}\n\n`;
          }

          // Add stacktrace if available
          if (exception.stacktrace?.frames && exception.stacktrace.frames.length > 0) {
            markdownText += formatStacktraceToMarkdown(exception.stacktrace);
            if (index < arr.length - 1) {
              markdownText += `------\n`;
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
          markdownText += ` (crashed)`;
        }
        if (activeThread.current) {
          markdownText += ` (current)`;
        }
        markdownText += `\n\n`;
        markdownText += formatStacktraceToMarkdown(activeThread.stacktrace);
      }
    }
  });

  return markdownText;
}

export const issueAndEventToMarkdown = (
  group: Group,
  event: Event | null | undefined,
  groupSummaryData: GroupSummaryData | null | undefined,
  autofixData: AutofixData | null | undefined,
  activeThreadId: number | undefined
): string => {
  // Format the basic issue information
  let markdownText = `# ${group.title}\n\n`;
  markdownText += `**Issue ID:** ${group.id}\n`;

  if (group.project?.slug) {
    markdownText += `**Project:** ${group.project?.slug}\n`;
  }

  if (event && typeof event.dateCreated === 'string') {
    markdownText += `**Date:** ${new Date(event.dateCreated).toLocaleString()}\n`;
  }

  if (groupSummaryData) {
    markdownText += `## Issue Summary\n${groupSummaryData.headline}\n`;
    markdownText += `**What's wrong:** ${groupSummaryData.whatsWrong}\n`;
    if (groupSummaryData.trace) {
      markdownText += `**In the trace:** ${groupSummaryData.trace}\n`;
    }
    if (groupSummaryData.possibleCause && !autofixData) {
      markdownText += `**Possible cause:** ${groupSummaryData.possibleCause}\n`;
    }
  }

  if (autofixData) {
    const rootCauseCopyText = getRootCauseCopyText(autofixData);
    const solutionCopyText = getSolutionCopyText(autofixData);

    if (rootCauseCopyText) {
      markdownText += `\n## Root Cause\n\`\`\`\n${rootCauseCopyText}\n\`\`\`\n`;
    }
    if (solutionCopyText) {
      markdownText += `\n## Solution\n\`\`\`\n${solutionCopyText}\n\`\`\`\n`;
    }
  }

  if (event) {
    markdownText += formatEventToMarkdown(event, activeThreadId);
  }

  return markdownText;
};

export const useCopyIssueDetails = (group: Group, event?: Event) => {
  const organization = useOrganization();

  // These aren't guarded by useAiConfig because they are both non fetching, and should only return data when it's fetched elsewhere.
  const {data: groupSummaryData} = useGroupSummaryData(group);
  const {data: autofixData} = useAutofixData({groupId: group.id});
  const activeThreadId = useActiveThreadId();

  const text = useMemo(() => {
    return issueAndEventToMarkdown(
      group,
      event,
      groupSummaryData,
      autofixData,
      activeThreadId
    );
  }, [group, event, groupSummaryData, autofixData, activeThreadId]);

  const {copy} = useCopyToClipboard();

  const handleCopyIssueDetailsAsMarkdown = useCallback(() => {
    copy(text, {successMessage: t('Copied issue to clipboard as Markdown')}).then(() => {
      trackAnalytics('issue_details.copy_issue_details_as_markdown', {
        organization,
        groupId: group.id,
        eventId: event?.id,
        hasAutofix: Boolean(autofixData),
        hasSummary: Boolean(groupSummaryData),
      });
    });
  }, [copy, text, organization, group.id, event?.id, autofixData, groupSummaryData]);

  useHotkeys([
    {
      match: 'command+alt+c',
      callback: handleCopyIssueDetailsAsMarkdown,
      skipPreventDefault: NODE_ENV === 'development',
    },
    {
      match: 'ctrl+alt+c',
      callback: handleCopyIssueDetailsAsMarkdown,
      skipPreventDefault: NODE_ENV === 'development',
    },
  ]);
};
