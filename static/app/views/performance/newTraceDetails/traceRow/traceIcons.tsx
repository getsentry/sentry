import {Fragment, useMemo} from 'react';
import clamp from 'lodash/clamp';

import {getTraceIssueSeverityClassName} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/utils';
import {TraceIcons} from 'sentry/views/performance/newTraceDetails/traceIcons';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {BaseNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/baseNode';
import type {VirtualizedViewManager} from 'sentry/views/performance/newTraceDetails/traceRenderers/virtualizedViewManager';

const TRACE_ICON_WIDTH = 18;
const TRACE_ICON_GROUP_GLYPH_WIDTH = 12;
const TRACE_ICON_GROUP_GAP = 2;
const TRACE_ICON_GROUP_HORIZONTAL_PADDING = 10;
const TRACE_ICON_GROUP_COUNT_MIN_WIDTH = 8;
const TRACE_ICON_GROUP_COUNT_APPROXIMATE_CHARACTER_WIDTH = 7;

interface TraceIssueIconsProps {
  errors: BaseNode['errors'];
  manager: VirtualizedViewManager;
  node: BaseNode;
  node_space: [number, number] | null;
  occurrences: BaseNode['occurrences'];
}

export function TraceIssueIcons(props: TraceIssueIconsProps) {
  const issues = useMemo(() => {
    return getRenderableTraceIssues(props.node, props.errors, props.occurrences);
  }, [props.node, props.errors, props.occurrences]);

  if (!issues.length) {
    return null;
  }

  return (
    <Fragment>
      {issues.map(({issue, childIssueCount}, i) => {
        const timestamp = getTraceIssueTimestamp(issue, props.node_space!);
        const className = getTraceIssueSeverityClassName(issue);

        if (childIssueCount) {
          const clampedTimestamp = clamp(
            timestamp,
            props.node_space![0],
            props.node_space![0] + props.node_space![1]
          );
          const width = getTraceIconGroupApproximateWidth(childIssueCount);
          const edge = props.manager.computeTraceIconEdge(clampedTimestamp, width);
          const anchorTimestamp = props.manager.computeTraceIconAnchorTimestamp(
            clampedTimestamp,
            edge
          );
          const left = props.manager.computeRelativeLeftPositionFromOrigin(
            anchorTimestamp,
            props.node_space!
          );

          return (
            <div
              key={i}
              data-test-id="trace-issue-icon"
              className={`TraceIconGroup ${className} ${getTraceIconEdgeClassName(
                edge,
                'TraceIconGroup'
              )}`}
              style={{left: left * 100 + '%'}}
            >
              <span className="TraceIconGlyph">
                <TraceIcons.Icon event={issue} />
              </span>
              <span data-test-id="trace-issue-count" className="TraceIconCount">
                {childIssueCount}
              </span>
            </div>
          );
        }

        const clampedTimestamp = clamp(
          timestamp,
          props.node_space![0],
          props.node_space![0] + props.node_space![1]
        );
        const edge = props.manager.computeTraceIconEdge(
          clampedTimestamp,
          TRACE_ICON_WIDTH
        );
        const anchorTimestamp = props.manager.computeTraceIconAnchorTimestamp(
          clampedTimestamp,
          edge
        );
        const left = props.manager.computeRelativeLeftPositionFromOrigin(
          anchorTimestamp,
          props.node_space!
        );

        return (
          <div
            key={i}
            data-test-id="trace-issue-icon"
            className={`TraceIcon ${className} ${getTraceIconEdgeClassName(
              edge,
              'TraceIcon'
            )}`}
            style={{left: left * 100 + '%'}}
          >
            <TraceIcons.Icon event={issue} />
          </div>
        );
      })}
    </Fragment>
  );
}

interface RenderableTraceIssue {
  issue: TraceTree.TraceIssue;
  childIssueCount?: number;
}

function getRenderableTraceIssues(
  node: BaseNode,
  errors: BaseNode['errors'],
  occurrences: BaseNode['occurrences']
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

  const childRepresentative = getMostSevereTraceIssue(childIssues);
  if (childRepresentative) {
    issues.push({issue: childRepresentative, childIssueCount: childIssues.length});
  }

  return issues;
}

export function getDirectErrors(node: BaseNode): Set<TraceTree.TraceErrorIssue> {
  const errors = new Set<TraceTree.TraceErrorIssue>();

  if (node.value && 'errors' in node.value && Array.isArray(node.value.errors)) {
    node.value.errors.forEach(error => errors.add(error));
  }

  return errors;
}

export function getDirectOccurrences(node: BaseNode): Set<TraceTree.TraceOccurrence> {
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

  return occurrences;
}

function getMostSevereTraceIssue(
  issues: TraceTree.TraceIssue[]
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

    if (
      severityDiff === 0 &&
      getTraceIssueTimestamp(issue, [0, 0]) < getTraceIssueTimestamp(mostSevere, [0, 0])
    ) {
      return issue;
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

function getTraceIssueTimestamp(
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

function getTraceIconEdgeClassName(
  edge: 'start' | 'end' | null,
  baseClassName: 'TraceIcon' | 'TraceIconGroup'
): string {
  if (edge === 'start') {
    return `${baseClassName}Start`;
  }

  if (edge === 'end') {
    return `${baseClassName}End`;
  }

  return '';
}

function getTraceIconGroupApproximateWidth(childIssueCount: number): number {
  const countWidth = Math.max(
    TRACE_ICON_GROUP_COUNT_MIN_WIDTH,
    String(childIssueCount).length * TRACE_ICON_GROUP_COUNT_APPROXIMATE_CHARACTER_WIDTH
  );

  return (
    TRACE_ICON_GROUP_HORIZONTAL_PADDING +
    TRACE_ICON_GROUP_GLYPH_WIDTH +
    TRACE_ICON_GROUP_GAP +
    countWidth
  );
}
