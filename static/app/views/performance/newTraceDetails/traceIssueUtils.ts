import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {BaseNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/baseNode';

export const TRACE_ICON_WIDTH = 18;
// Keep these in sync with the `.TraceIconGroup` CSS in trace.tsx.
const TRACE_ICON_GROUP_GLYPH_WIDTH = 12;
const TRACE_ICON_GROUP_GAP = 2;
const TRACE_ICON_GROUP_HORIZONTAL_PADDING = 10;
const TRACE_ICON_GROUP_COUNT_MIN_WIDTH = 8;

interface RenderableTraceIssue {
  issue: TraceTree.TraceIssue;
  additionalIssueCount?: number;
}

export function getRenderableTraceIssues(
  node: BaseNode,
  errors: BaseNode['errors'],
  occurrences: BaseNode['occurrences'],
  nodeSpace: [number, number] | null = null
): RenderableTraceIssue[] {
  const directErrors = getDirectErrors(node);
  const directOccurrences = getDirectOccurrences(node);
  const childIssues: TraceTree.TraceIssue[] = [];
  const issues: RenderableTraceIssue[] = [];

  for (const error of errors) {
    if (directErrors.has(error)) {
      issues.push({issue: error});
    } else {
      childIssues.push(error);
    }
  }

  for (const occurrence of occurrences) {
    if (directOccurrences.has(occurrence)) {
      issues.push({issue: occurrence});
    } else {
      childIssues.push(occurrence);
    }
  }

  const childRepresentative = getMostSevereTraceIssue(childIssues, nodeSpace);
  if (childRepresentative) {
    const additionalIssueCount = childIssues.length - 1;
    issues.push(
      additionalIssueCount > 0
        ? {issue: childRepresentative, additionalIssueCount}
        : {issue: childRepresentative}
    );
  }

  return issues;
}

export function getTraceIconGroupWidth(
  additionalIssueCount: number,
  measureText: (text: string) => number
) {
  const countWidth = Math.max(
    TRACE_ICON_GROUP_COUNT_MIN_WIDTH,
    Math.ceil(measureText(String(additionalIssueCount)))
  );

  return (
    TRACE_ICON_GROUP_HORIZONTAL_PADDING +
    TRACE_ICON_GROUP_GLYPH_WIDTH +
    TRACE_ICON_GROUP_GAP +
    countWidth
  );
}

const directErrorsCache = new WeakMap<BaseNode, Set<TraceTree.TraceErrorIssue>>();

export function getDirectErrors(node: BaseNode): Set<TraceTree.TraceErrorIssue> {
  const cached = directErrorsCache.get(node);
  if (cached) {
    return cached;
  }

  const errors = new Set<TraceTree.TraceErrorIssue>();

  if (node.value && 'errors' in node.value && Array.isArray(node.value.errors)) {
    node.value.errors.forEach(error => errors.add(error));
  }

  directErrorsCache.set(node, errors);
  return errors;
}

const directOccurrencesCache = new WeakMap<BaseNode, Set<TraceTree.TraceOccurrence>>();

export function getDirectOccurrences(node: BaseNode): Set<TraceTree.TraceOccurrence> {
  const cached = directOccurrencesCache.get(node);
  if (cached) {
    return cached;
  }

  const occurrences = new Set<TraceTree.TraceOccurrence>();

  if (
    node.value &&
    'occurrences' in node.value &&
    Array.isArray(node.value.occurrences)
  ) {
    node.value.occurrences.forEach(occurrence => occurrences.add(occurrence));
  }

  if (
    node.value &&
    'performance_issues' in node.value &&
    Array.isArray(node.value.performance_issues)
  ) {
    node.value.performance_issues.forEach(occurrence => occurrences.add(occurrence));
  }

  directOccurrencesCache.set(node, occurrences);
  return occurrences;
}

function getMostSevereTraceIssue(
  issues: TraceTree.TraceIssue[],
  nodeSpace: [number, number] | null
): TraceTree.TraceIssue | null {
  return issues.reduce<TraceTree.TraceIssue | null>((mostSevere, issue) => {
    if (!mostSevere) {
      return issue;
    }

    const severityDiff =
      getTraceIssueSeverityRank(issue) - getTraceIssueSeverityRank(mostSevere);

    if (severityDiff > 0) {
      return issue;
    }

    if (severityDiff === 0 && nodeSpace) {
      const issueTimestamp = getTraceIssueTimestamp(issue, nodeSpace);
      const mostSevereTimestamp = getTraceIssueTimestamp(mostSevere, nodeSpace);
      if (issueTimestamp < mostSevereTimestamp) {
        return issue;
      }
    }

    return mostSevere;
  }, null);
}

function getTraceIssueSeverityRank(issue: TraceTree.TraceIssue): number {
  switch (issue.level) {
    case 'fatal':
      return 5;
    case 'error':
      return 4;
    case 'warning':
      return 3;
    case 'info':
      return 2;
    default:
      return 1;
  }
}

export function getTraceIssueTimestamp(
  issue: TraceTree.TraceIssue,
  nodeSpace: [number, number]
): number {
  if ('timestamp' in issue && typeof issue.timestamp === 'number') {
    return issue.timestamp * 1e3;
  }

  let startTimestamp: number | undefined;
  if ('start_timestamp' in issue) {
    startTimestamp = issue.start_timestamp;
  } else if ('start' in issue) {
    startTimestamp = issue.start;
  }

  return typeof startTimestamp === 'number' ? startTimestamp * 1e3 : nodeSpace[0];
}
