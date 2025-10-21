import {Fragment, useMemo} from 'react';
import clamp from 'lodash/clamp';

import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {BaseNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/baseNode';
import type {VirtualizedViewManager} from 'sentry/views/performance/newTraceDetails/traceRenderers/virtualizedViewManager';

function getMaxErrorSeverity(errors: TraceTree.TraceErrorIssue[]) {
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
    return getMaxErrorSeverity(errors);
  }, [errors]);

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
                <div className="TracePattern occurence" />
              </div>
            );
          })}
        </Fragment>
      ) : null}
    </Fragment>
  );
}
