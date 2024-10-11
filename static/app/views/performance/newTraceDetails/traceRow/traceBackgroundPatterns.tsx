import {Fragment, useMemo} from 'react';
import clamp from 'lodash/clamp';

import type {TraceTree} from '../traceModels/traceTree';
import type {TraceTreeNode} from '../traceModels/traceTreeNode';
import type {VirtualizedViewManager} from '../traceRenderers/virtualizedViewManager';

function getMaxErrorSeverity(errors: TraceTree.TraceError[]) {
  return errors.reduce((acc, error) => {
    if (error.level === 'fatal') {
      return 'fatal';
    }
    if (error.level === 'error') {
      return acc === 'fatal' ? 'fatal' : 'error';
    }
    if (error.level === 'warning') {
      return acc === 'fatal' || acc === 'error' ? acc : 'warning';
    }
    return acc;
  }, 'default');
}

interface BackgroundPatternsProps {
  errors: TraceTreeNode<TraceTree.Transaction>['errors'];
  manager: VirtualizedViewManager;
  node_space: [number, number] | null;
  performance_issues: TraceTreeNode<TraceTree.Transaction>['performance_issues'];
}

export function TraceBackgroundPatterns(props: BackgroundPatternsProps) {
  const performance_issues = useMemo(() => {
    if (!props.performance_issues.size) {
      return [];
    }

    return [...props.performance_issues];
  }, [props.performance_issues]);

  const errors = useMemo(() => {
    if (!props.errors.size) {
      return [];
    }
    return [...props.errors];
  }, [props.errors]);

  const severity = useMemo(() => {
    return getMaxErrorSeverity(errors);
  }, [errors]);

  if (!props.performance_issues.size && !props.errors.size) {
    return null;
  }

  // If there is an error, render the error pattern across the entire width.
  // Else if there is a performance issue, render the performance issue pattern
  // for the duration of the performance issue. If there is a profile, render
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
      ) : performance_issues.length > 0 ? (
        <Fragment>
          {performance_issues.map((issue, i) => {
            const timestamp = issue.start * 1e3;
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
                <div className="TracePattern performance_issue" />
              </div>
            );
          })}
        </Fragment>
      ) : null}
    </Fragment>
  );
}
