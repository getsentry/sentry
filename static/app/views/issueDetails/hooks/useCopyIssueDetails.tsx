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
import {
  getKeyValueListData,
  keyValueListDataToMarkdownLines,
} from 'sentry/components/events/eventStatisticalDetector/eventRegressionSummary';
import {getSpanInfoFromTransactionEvent} from 'sentry/components/events/interfaces/performance/utils';
import {
  useGroupSummaryData,
  type GroupSummaryData,
} from 'sentry/components/group/groupSummary';
import {NODE_ENV} from 'sentry/constants';
import {t} from 'sentry/locale';
import {EntryType, type Event, type EventTransaction} from 'sentry/types/event';
import {
  AI_DETECTED_ISSUE_TYPES,
  getIssueTypeFromOccurrenceType,
  isTransactionBased,
  type Group,
} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {StacktraceType} from 'sentry/types/stacktrace';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';
import {useOrganization} from 'sentry/utils/useOrganization';

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

function getSpanMarkdownValue(
  span: {description?: string; op?: string} | null | undefined
): string {
  const {op, description} = span ?? {};
  if (op && description) {
    return `${op} - ${description}`;
  }
  return description || op || t('(no value)');
}

/**
 * Builds a Markdown representation of the "Span Evidence" section shown on the
 * issue details page for performance, profiling, and other occurrence-based
 * issues. Returns an empty string for issues that don't expose span evidence
 * (e.g. errors).
 */
function formatSpanEvidenceToMarkdown(event: Event, organization: Organization): string {
  const eventTransaction = event as EventTransaction;
  const issueType =
    eventTransaction.perfProblem?.issueType ??
    getIssueTypeFromOccurrenceType(event.occurrence?.type);

  if (!issueType) {
    return '';
  }

  const regressionData = getKeyValueListData(organization, issueType, event);
  if (regressionData) {
    const regressionLines = keyValueListDataToMarkdownLines(regressionData);
    if (regressionLines.length === 0) {
      return '';
    }
    return `\n## Span Evidence\n\n${regressionLines.join('\n')}\n`;
  }

  const evidenceData = event.occurrence?.evidenceData ?? {};
  const evidenceDisplay = event.occurrence?.evidenceDisplay ?? [];
  // Only attempt to resolve span info when the event actually carries the
  // evidence payload, to avoid the error capture inside the helper.
  const spanInfo =
    eventTransaction.perfProblem || event.occurrence?.evidenceData
      ? getSpanInfoFromTransactionEvent(eventTransaction)
      : null;

  type EvidenceSpan = {description?: string; op?: string} | null | undefined;
  const lines: string[] = [];
  const typeId = event.occurrence?.type;

  // Match spanEvidenceKeyValueList: transaction events use event.title; profiling
  // and other non-transaction issues use evidenceData or evidenceDisplay instead.
  if (isTransactionBased(typeId) && event.title) {
    lines.push(`**Transaction:** ${event.title}`);
  } else if (evidenceData.transactionName) {
    lines.push(`**Transaction:** ${evidenceData.transactionName}`);
  } else if (evidenceData.transaction) {
    lines.push(`**Transaction:** ${evidenceData.transaction}`);
  } else if (issueType && AI_DETECTED_ISSUE_TYPES.has(issueType) && event.title) {
    lines.push(`**Transaction:** ${event.title}`);
  }

  if (spanInfo?.parentSpan) {
    lines.push(`**Parent Span:** ${getSpanMarkdownValue(spanInfo.parentSpan)}`);
  }

  const causeSpans: EvidenceSpan[] = spanInfo?.causeSpans?.filter(Boolean) ?? [];
  if (causeSpans.length === 1) {
    lines.push(`**Preceding Span:** ${getSpanMarkdownValue(causeSpans[0])}`);
  } else if (causeSpans.length > 1) {
    lines.push('**Preceding Spans:**');
    causeSpans.forEach(span => {
      lines.push(`- ${getSpanMarkdownValue(span)}`);
    });
  }

  const offendingSpans: EvidenceSpan[] = spanInfo?.offendingSpans?.filter(Boolean) ?? [];
  if (offendingSpans.length > 0) {
    lines.push(`**Offending Spans (${offendingSpans.length}):**`);
    offendingSpans.forEach(span => {
      lines.push(`- ${getSpanMarkdownValue(span)}`);
    });
  }

  if (evidenceData.patternSize > 0) {
    lines.push(`**Pattern Size:** ${evidenceData.patternSize}`);
  }

  // Evidence display rows are pre-formatted name/value pairs used by profiling
  // and several other issue types.
  evidenceDisplay.forEach(item => {
    if (item?.name) {
      lines.push(`**${item.name}:** ${item.value}`);
    }
  });

  if (lines.length === 0) {
    return '';
  }

  return `\n## Span Evidence\n\n${lines.join('\n')}\n`;
}

export const issueAndEventToMarkdown = (
  group: Group,
  event: Event | null | undefined,
  groupSummaryData: GroupSummaryData | null | undefined,
  autofixData: ExplorerAutofixState | null | undefined,
  activeThreadId: number | undefined,
  organization: Organization
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
    markdownText += formatSpanEvidenceToMarkdown(event, organization);
    markdownText += formatEventToMarkdown(event, activeThreadId);
  }

  return markdownText;
};

export const useCopyIssueDetails = (group: Group, event?: Event) => {
  const organization = useOrganization();

  const {data: groupSummaryData} = useGroupSummaryData(group);
  const {runState: autofixData} = useExplorerAutofix(group.id, {enabled: false});
  const activeThreadId = useActiveThreadId();

  const text = useMemo(() => {
    return issueAndEventToMarkdown(
      group,
      event,
      groupSummaryData,
      autofixData,
      activeThreadId,
      organization
    );
  }, [group, event, groupSummaryData, autofixData, activeThreadId, organization]);

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
      match: 'mod+alt+c',
      callback: handleCopyIssueDetailsAsMarkdown,
      skipPreventDefault: NODE_ENV === 'development',
    },
  ]);
};
