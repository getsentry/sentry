import {
  getKeyValueListData,
  keyValueListDataToMarkdownLines,
} from 'sentry/components/events/eventStatisticalDetector/eventRegressionSummary';
import {
  formatChangingQueryParameters,
  getSpanDuration,
  getSpanFieldBytes,
} from 'sentry/components/events/interfaces/performance/spanMetrics';
import {getSpanInfoFromTransactionEvent} from 'sentry/components/events/interfaces/performance/utils';
import {
  EntryType,
  type EntryRequest,
  type Event,
  type EventTransaction,
} from 'sentry/types/event';
import {
  AI_DETECTED_ISSUE_TYPES,
  type Group,
  isTransactionBased,
  IssueType,
} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {toRoundedPercent} from 'sentry/utils/number/toRoundedPercent';
import {SQLishFormatter} from 'sentry/utils/sqlish';
import {getPerformanceDuration} from 'sentry/views/performance/utils/getPerformanceDuration';

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
  return description || op || '(no value)';
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
  event: EventTransaction,
  sampleBudget: number
): {lines: string[]; remaining: number} {
  const valid = spans.filter(Boolean);
  if (valid.length === 0) {
    return {lines: [], remaining: sampleBudget};
  }

  const lines = [`**${heading} (${valid.length}):**`];

  const byOp = new Map<string, EvidenceSpan[]>();
  valid.forEach(span => {
    const op = span?.op || '(no op)';
    const existing = byOp.get(op) ?? [];
    existing.push(span);
    byOp.set(op, existing);
  });

  let remaining = sampleBudget;

  byOp.forEach((group, op) => {
    const count = group.length;
    const distinct = Array.from(
      new Set(group.map(normalizeSpanDescription).filter(Boolean))
    );
    const totalMs = group.reduce((sum, span) => sum + getSpanDuration(span), 0);
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
      const sampleCount = Math.min(MAX_SAMPLE_SPANS, remaining, distinct.length);
      distinct.slice(0, sampleCount).forEach(description => {
        lines.push(`  - ${description}`);
      });
      remaining -= sampleCount;
      if (distinct.length > sampleCount) {
        lines.push(`  - …and ${distinct.length - sampleCount} more`);
      }
    }

    const codeLocation = group.map(getSpanCodeLocation).find(Boolean);
    if (codeLocation) {
      lines.push(`  code: ${codeLocation}`);
    }
  });

  return {lines, remaining};
}

/** Pushes a labeled value, or a bulleted list when there are multiple items. */
function pushList(lines: string[], label: string, items: string[]): void {
  if (items.length === 0) {
    return;
  }
  if (items.length === 1) {
    lines.push(`**${label}:** ${items[0]}`);
    return;
  }
  lines.push(`**${label}:**`);
  items.forEach(item => lines.push(`- ${item}`));
}

/**
 * Type-specific metrics the UI's Span Evidence panel shows but the generic span
 * summary doesn't. These are additive (no overlap with the transaction/parent/
 * offending/pattern rows) and sourced from evidenceData or the offending span's
 * data — the same fields the per-type components in spanEvidenceKeyValueList use.
 */
function formatIssueTypeMetrics(
  issueType: IssueType,
  event: EventTransaction,
  offendingSpans: EvidenceSpan[],
  evidenceData: Record<string, any>
): string[] {
  const lines: string[] = [];
  const offender = offendingSpans[0] ?? null;

  switch (issueType) {
    case IssueType.PERFORMANCE_LARGE_HTTP_PAYLOAD: {
      const size =
        getSpanFieldBytes(offender, 'http.response_content_length') ??
        getSpanFieldBytes(offender, 'Encoded Body Size');
      if (size) {
        lines.push(`**Payload Size:** ${size}`);
      }
      break;
    }
    case IssueType.PERFORMANCE_UNCOMPRESSED_ASSET: {
      const size =
        getSpanFieldBytes(offender, 'http.response_content_length') ??
        getSpanFieldBytes(offender, 'Encoded Body Size');
      if (size) {
        lines.push(`**Asset Size:** ${size}`);
      }
      break;
    }
    case IssueType.PERFORMANCE_RENDER_BLOCKING_ASSET: {
      const fcp = event.measurements?.fcp?.value;
      const duration = getSpanDuration(offender);
      if (fcp && duration) {
        lines.push(
          `**FCP Delay:** ${getPerformanceDuration(duration)} (${toRoundedPercent(
            duration / fcp
          )} of FCP)`
        );
      }
      break;
    }
    case IssueType.PERFORMANCE_N_PLUS_ONE_API_CALLS: {
      // Mirror the UI: fall back to deriving changing query params from the
      // offending HTTP spans when the backend didn't provide them.
      const baseURL = event.entries?.find(
        (entry): entry is EntryRequest => entry.type === EntryType.REQUEST
      )?.data?.url;
      pushList(
        lines,
        'Query Parameters',
        evidenceData.parameters ?? formatChangingQueryParameters(offendingSpans, baseURL)
      );
      pushList(lines, 'Path Parameters', evidenceData.pathParameters ?? []);
      break;
    }
    case IssueType.QUERY_INJECTION_VULNERABILITY: {
      const vulnerable: Array<[string, unknown]> =
        evidenceData.vulnerableParameters ?? [];
      pushList(
        lines,
        'Vulnerable Parameters',
        vulnerable.map(([name, value]) => {
          const formatted = typeof value === 'string' ? value : JSON.stringify(value);
          return `${name}: ${formatted}`;
        })
      );
      if (evidenceData.requestUrl) {
        lines.push(`**Request URL:** ${evidenceData.requestUrl}`);
      }
      break;
    }
    default:
      break;
  }

  return lines;
}

/**
 * Builds a Markdown representation of the "Span Evidence" section shown on the
 * issue details page for performance, profiling, and other occurrence-based
 * issues. Returns an empty string for issues that don't expose span evidence
 * (e.g. errors).
 */
export function formatSpanEvidenceToMarkdown(
  event: Event,
  organization: Organization,
  group: Group
): string {
  const issueType = group.issueType;

  const regressionData = getKeyValueListData(organization, issueType, event);
  if (regressionData) {
    const regressionLines = keyValueListDataToMarkdownLines(regressionData);
    if (regressionLines.length === 0) {
      return '';
    }
    // Regressions surface metrics (not spans); the UI shows these under a
    // separate "Regression Summary" section, so mirror that heading here.
    return `\n## Regression Summary\n\n${regressionLines.join('\n')}\n`;
  }

  // Only emit span evidence for issue types whose config enables it — the same
  // flag the issue page uses to decide whether to render the Span Evidence panel.
  // This excludes regressions (their summary is handled above) plus metric and
  // other categories that don't expose span evidence, and stays in sync as new
  // performance types are added.
  if (!getConfigForIssueType(group, group.project).spanEvidence.enabled) {
    return '';
  }

  const evidenceData = event.occurrence?.evidenceData ?? {};
  const evidenceDisplay = event.occurrence?.evidenceDisplay ?? [];

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
    //
    // Safe to treat the event as a transaction now that we've verified it's a
    // transaction-based perf issue.
    const eventTransaction = event as EventTransaction;
    // Only resolve span info when the event carries the evidence payload, to
    // avoid the error capture inside the helper.
    const spanInfo =
      eventTransaction.perfProblem || event.occurrence?.evidenceData
        ? getSpanInfoFromTransactionEvent(eventTransaction)
        : null;

    if (spanInfo?.parentSpan) {
      lines.push(`**Parent Span:** ${getSpanMarkdownValue(spanInfo.parentSpan)}`);
    }

    // One sample budget shared across both span groups so the whole section
    // stays bounded, not each group independently.
    let sampleBudget = MAX_SAMPLE_SPANS_PER_SECTION;

    const causeSpans: EvidenceSpan[] = spanInfo?.causeSpans?.filter(Boolean) ?? [];
    const preceding = summarizeSpanGroup(
      'Preceding Spans',
      causeSpans,
      eventTransaction,
      sampleBudget
    );
    lines.push(...preceding.lines);
    sampleBudget = preceding.remaining;

    const offendingSpans: EvidenceSpan[] =
      spanInfo?.offendingSpans?.filter(Boolean) ?? [];
    const offending = summarizeSpanGroup(
      'Offending Spans',
      offendingSpans,
      eventTransaction,
      sampleBudget
    );
    lines.push(...offending.lines);

    // Type-specific metrics the UI shows beyond the generic span summary.
    lines.push(
      ...formatIssueTypeMetrics(issueType, eventTransaction, offendingSpans, evidenceData)
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
