import {Fragment, useMemo} from 'react';
import clamp from 'lodash/clamp';

import {getTraceIssueSeverityClassName} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/utils';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {BaseNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/baseNode';
import type {VirtualizedViewManager} from 'sentry/views/performance/newTraceDetails/traceRenderers/virtualizedViewManager';

function getMaxIssueSeverity(
  errors: TraceTree.TraceErrorIssue[],
  occurrences: TraceTree.TraceOccurrence[]
) {
  const issues = [...errors, ...occurrences];
  return issues.reduce((acc, issue) => {
    const severity = getTraceIssueSeverityClassName(issue);
    if (severity === 'fatal') {
      return 'fatal';
    }
    if (severity === 'error') {
      return acc === 'fatal' ? 'fatal' : 'error';
    }
    if (severity === 'warning' || severity === 'occurence') {
      return acc === 'fatal' || acc === 'error' ? acc : severity;
    }
    return acc;
  }, 'default');
}

interface BackgroundPatternsProps {
  errors: BaseNode['errors'];
  manager: VirtualizedViewManager;
  node_space: [number, number] | null;
  occurrences: BaseNode['occurrences'];
}

export function TraceBackgroundPatterns(props: BackgroundPatternsProps) {
  const occurences = useMemo(() => {
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
    return getMaxIssueSeverity(errors, occurences);
  }, [errors, occurences]);

  if (!props.occurrences.size && !props.errors.size) {
    return null;
  }

  // If there is an error, render the error pattern across the entire width.
  // Else if there is an occurence, render the occurence pattern
  // for the duration of the occurence. If there is a profile, render
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
      ) : occurences.length > 0 ? (
        <Fragment>
          {occurences.map((occurence, i) => {
            const timestamp =
              'start_timestamp' in occurence
                ? occurence.start_timestamp * 1e3
                : occurence.start * 1e3;
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
