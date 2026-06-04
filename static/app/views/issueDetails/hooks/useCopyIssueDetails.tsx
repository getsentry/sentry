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
  IssueType,
  type Group,
} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {StacktraceType} from 'sentry/types/stacktrace';
import {trackAnalytics} from 'sentry/utils/analytics';
import {toRoundedPercent} from 'sentry/utils/number/toRoundedPercent';
import {SQLishFormatter} from 'sentry/utils/sqlish';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';
import {useOrganization} from 'sentry/utils/useOrganization';
import {getPerformanceDuration} from 'sentry/views/performance/utils/getPerformanceDuration';

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

type EvidenceSpan = {
  data?: Record<string, any>;
  description?: string;
  op?: string;
  start_timestamp?: number;
  timestamp?: number;
} | null;

const sqlFormatter = new SQLishFormatter();

// Show at most this many distinct sample values for a single repeated span
// group so large N+1s don't produce a wall of near-identical lines.
const MAX_SAMPLE_SPANS = 5;

// Overall budget for sample detail lines across one section (mirrors the
// sentry-mcp MAX_SPANS_IN_TREE bound). Op-group summary lines always render
// since they're compact and high-signal; only the per-value samples draw from
// this budget, guaranteeing bounded output even for many distinct offenders.
const MAX_SAMPLE_SPANS_PER_SECTION = 10;

function getSpanMarkdownValue(span: EvidenceSpan): string {
  const {op, description} = span ?? {};
  if (op && description) {
    return `${op} - ${description}`;
  }
  return description || op || t('(no value)');
}

/**
 * Collapses whitespace; SQL descriptions are run through the same formatter the
 * Span Evidence UI uses so multi-line queries become a single readable line.
 */
function normalizeSpanDescription(span: EvidenceSpan): string {
  const description = span?.description ?? '';
  if (!description) {
    return '';
  }
  if (span?.op?.startsWith('db')) {
    return sqlFormatter.toString(description);
  }
  return description.replace(/\s+/g, ' ').trim();
}

/** Mirrors the `code.*` span data the UI's SlowDBQueryEvidence renders. */
function getSpanCodeLocation(span: EvidenceSpan): string | null {
  const data = span?.data;
  const filepath = data?.['code.filepath'];
  if (!filepath) {
    return null;
  }
  const lineno = data?.['code.lineno'];
  const fn = data?.['code.function'];
  const location = lineno === undefined ? filepath : `${filepath}:${lineno}`;
  return fn ? `${location} ${fn}` : location;
}

function getSpanDurationMs(span: EvidenceSpan): number {
  return ((span?.timestamp ?? 0) - (span?.start_timestamp ?? 0)) * 1000;
}

/**
 * Formats total time for a span group, plus its share of the transaction
 * (Duration Impact) when the transaction duration is known. Same math as
 * spanEvidenceKeyValueList.
 */
function formatGroupTiming(totalMs: number, event: EventTransaction): string {
  const duration = getPerformanceDuration(totalMs);
  const transactionMs = (event.endTimestamp - event.startTimestamp) * 1000;
  if (!transactionMs || Number.isNaN(transactionMs)) {
    return duration;
  }
  return `${duration}, ${toRoundedPercent(totalMs / transactionMs)} of txn`;
}

/**
 * Summarizes a list of spans grouped by `op`, deduping repeated descriptions
 * and surfacing cardinality (e.g. distinct cache keys), timing, and code
 * location. Keeps the markdown compact for large N+1s.
 */
function summarizeSpanGroup(
  heading: string,
  spans: EvidenceSpan[],
  event: EventTransaction
): string[] {
  const valid = spans.filter(Boolean);
  if (valid.length === 0) {
    return [];
  }

  const lines = [`**${heading} (${valid.length}):**`];

  const byOp = new Map<string, EvidenceSpan[]>();
  valid.forEach(span => {
    const op = span?.op || '(no op)';
    byOp.set(op, [...(byOp.get(op) ?? []), span]);
  });

  let sampleBudget = MAX_SAMPLE_SPANS_PER_SECTION;

  byOp.forEach((group, op) => {
    const count = group.length;
    const distinct = Array.from(
      new Set(group.map(normalizeSpanDescription).filter(Boolean))
    );
    const totalMs = group.reduce((sum, span) => sum + getSpanDurationMs(span), 0);
    const timing = formatGroupTiming(totalMs, event);
    const repeat = count > 1 ? `${count}×, ` : '';

    if (distinct.length <= 1) {
      const description = distinct[0];
      if (op.startsWith('db') && description) {
        lines.push(`- \`${op}\` (${repeat}${timing}):`);
        lines.push('```sql', description, '```');
      } else {
        lines.push(
          `- \`${op}\`${description ? ` — ${description}` : ''} (${repeat}${timing})`
        );
      }
    } else {
      const cardinality = op.startsWith('cache') ? 'distinct keys' : 'distinct values';
      lines.push(`- \`${op}\` (${repeat}${distinct.length} ${cardinality}, ${timing})`);
      // Draw samples from the shared section budget so the total stays bounded.
      const sampleCount = Math.min(MAX_SAMPLE_SPANS, sampleBudget, distinct.length);
      distinct.slice(0, sampleCount).forEach(description => {
        lines.push(`  - ${description}`);
      });
      sampleBudget -= sampleCount;
      if (distinct.length > sampleCount) {
        lines.push(`  - …and ${distinct.length - sampleCount} more`);
      }
    }

    const codeLocation = group.map(getSpanCodeLocation).find(Boolean);
    if (codeLocation) {
      lines.push(`  code: ${codeLocation}`);
    }
  });

  return lines;
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

  // Regression issues only use getKeyValueListData (see RegressionEvidence in
  // spanEvidenceKeyValueList). Without evidenceData, omit the section rather than
  // falling through to generic span evidence (which can show event.title as Transaction).
  if (
    issueType === IssueType.PERFORMANCE_ENDPOINT_REGRESSION ||
    issueType === IssueType.PROFILE_FUNCTION_REGRESSION
  ) {
    return '';
  }

  const evidenceData = event.occurrence?.evidenceData ?? {};
  const evidenceDisplay = event.occurrence?.evidenceDisplay ?? [];
  // Only attempt to resolve span info when the event actually carries the
  // evidence payload, to avoid the error capture inside the helper.
  const spanInfo =
    eventTransaction.perfProblem || event.occurrence?.evidenceData
      ? getSpanInfoFromTransactionEvent(eventTransaction)
      : null;

  const lines: string[] = [];
  const typeId = event.occurrence?.type;
  const transactionBased = isTransactionBased(typeId);

  // Transaction name: transaction events use event.title; profiling/AI and other
  // non-transaction issues fall back to evidenceData.
  if (transactionBased && event.title) {
    lines.push(`**Transaction:** ${event.title}`);
  } else if (evidenceData.transactionName) {
    lines.push(`**Transaction:** ${evidenceData.transactionName}`);
  } else if (evidenceData.transaction) {
    lines.push(`**Transaction:** ${evidenceData.transaction}`);
  } else if (AI_DETECTED_ISSUE_TYPES.has(issueType) && event.title) {
    lines.push(`**Transaction:** ${event.title}`);
  }

  if (transactionBased) {
    // Transaction-based issues (N+1, slow query, consecutive, etc.) carry the
    // offending spans in the event. Summarize them with dedup, cardinality,
    // timing and code location instead of dumping every span.
    if (spanInfo?.parentSpan) {
      lines.push(`**Parent Span:** ${getSpanMarkdownValue(spanInfo.parentSpan)}`);
    }

    const causeSpans: EvidenceSpan[] = spanInfo?.causeSpans?.filter(Boolean) ?? [];
    lines.push(...summarizeSpanGroup('Preceding Spans', causeSpans, eventTransaction));

    const offendingSpans: EvidenceSpan[] =
      spanInfo?.offendingSpans?.filter(Boolean) ?? [];
    lines.push(
      ...summarizeSpanGroup('Offending Spans', offendingSpans, eventTransaction)
    );

    // Surface the cache-miss → DB read shape when both appear (classic N+1).
    const hasCacheMiss = offendingSpans.some(span => span?.op?.startsWith('cache'));
    const hasDbRead = offendingSpans.some(span => span?.op?.startsWith('db'));
    if (hasCacheMiss && hasDbRead) {
      lines.push('_Pattern: cache miss → DB read, repeated per entity._');
    }

    if (evidenceData.patternSize > 0) {
      lines.push(`**Pattern Size:** ${evidenceData.patternSize}`);
    }
  } else {
    // Profiling / AI-detected and other non-transaction issues expose
    // pre-formatted name/value rows instead of computed spans.
    evidenceDisplay.forEach(item => {
      if (item?.name) {
        lines.push(`**${item.name}:** ${item.value}`);
      }
    });
  }

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
