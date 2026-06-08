import {useCallback, useMemo, useSyncExternalStore} from 'react';

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
import {EntryType, type Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {StacktraceType} from 'sentry/types/stacktrace';
import {trackAnalytics} from 'sentry/utils/analytics';
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

function formatEventToMarkdown(event: Event, activeThreadId: number | undefined): string {
  let markdownText = '';

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
    }
  });

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

  if (group.project?.slug) {
    markdownText += `**Project:** ${group.project?.slug}\n`;
  }

  if (event && typeof event.dateCreated === 'string') {
    markdownText += `**Date:** ${new Date(event.dateCreated).toLocaleString()}\n`;
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

  const {runState: autofixData} = useExplorerAutofix(group.id, {enabled: false});
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
