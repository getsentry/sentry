import {Fragment, useMemo} from 'react';
import clamp from 'lodash/clamp';

import {
  getTraceIssueSeverityClassName,
  type TraceIssueSeverityClassName,
} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/utils';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {BaseNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/baseNode';
import type {VirtualizedViewManager} from 'sentry/views/performance/newTraceDetails/traceRenderers/virtualizedViewManager';

const TRACE_ISSUE_SEVERITY_RANK: Record<TraceIssueSeverityClassName, number> = {
  fatal: 0,
  error: 1,
  warning: 2,
  info: 3,
  occurrence: 4,
  default: 5,
  unknown: 6,
  sample: 7,
};

function getMaxIssueSeverity(
  errors: TraceTree.TraceErrorIssue[],
  occurrences: TraceTree.TraceOccurrence[]
) {
  const issues = [...errors, ...occurrences];
  return issues.reduce<TraceIssueSeverityClassName>((acc, issue) => {
    const severity = getTraceIssueSeverityClassName(issue);
    return TRACE_ISSUE_SEVERITY_RANK[severity] < TRACE_ISSUE_SEVERITY_RANK[acc]
      ? severity
      : acc;
  }, 'default');
}

interface BackgroundPatternsProps {
  errors: BaseNode['errors'];
  manager: VirtualizedViewManager;
  node_space: [number, number] | null;
  occurrences: BaseNode['occurrences'];
}

export function TraceBackgroundPatterns(props: BackgroundPatternsProps) {
  const occurrences = useMemo(() => {
    if (!props.occurrences.size) {
      return [];
    }

    return [...props.occurrences];
  }, [props.occurrences]);

  const errors = useMemo(() => {
    if (!props.errors.size) {
      return [];
    }
    return [...props.errors];
  }, [props.errors]);

  const severity = useMemo(() => {
    return getMaxIssueSeverity(errors, occurrences);
  }, [errors, occurrences]);

  if (!props.occurrences.size && !props.errors.size) {
    return null;
  }

  // If there is an error, render the error pattern across the entire width.
  // Else if there is an occurrence, render the occurrence pattern
  // for the duration of the occurrence. If there is a profile, render
  // the profile pattern for entire duration (we do not have profile durations here)
  return (
    <Fragment>
      {errors.length > 0 ? (
        <div
          className="TracePatternContainer"
          style={{
            left: 0,
            width: '100%',
          }}
        >
          <div className={`TracePattern ${severity}`} />
        </div>
      ) : occurrences.length > 0 ? (
        <Fragment>
          {occurrences.map((occurrence, i) => {
            const timestamp =
              'start_timestamp' in occurrence
                ? occurrence.start_timestamp * 1e3
                : occurrence.start * 1e3;
            // Clamp the issue timestamp to the span's timestamp
            const left = props.manager.computeRelativeLeftPositionFromOrigin(
              clamp(
                timestamp,
                props.node_space![0],
                props.node_space![0] + props.node_space![1]
              ),
              props.node_space!
            );

            return (
              <div
                key={i}
                className="TracePatternContainer"
                style={{
                  left: left * 100 + '%',
                  width: (1 - left) * 100 + '%',
                }}
              >
                <div className={`TracePattern ${severity}`} />
              </div>
            );
          })}
        </Fragment>
      ) : null}
    </Fragment>
  );
}
