import {Fragment, useMemo} from 'react';
import clamp from 'lodash/clamp';

import {getTraceIssueSeverityClassName} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/utils';
import {TraceIcons} from 'sentry/views/performance/newTraceDetails/traceIcons';
import type {BaseNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/baseNode';
import type {VirtualizedViewManager} from 'sentry/views/performance/newTraceDetails/traceRenderers/virtualizedViewManager';

interface ErrorIconsProps {
  errors: BaseNode['errors'];
  manager: VirtualizedViewManager;
  node_space: [number, number] | null;
}

export function TraceErrorIcons(props: ErrorIconsProps) {
  const errors = useMemo(() => {
    return [...props.errors];
  }, [props.errors]);

  if (!props.errors.size) {
    return null;
  }

  return (
    <Fragment>
      {errors.map((error, i) => {
        const timestamp =
          'start_timestamp' in error ? error.start_timestamp : error.timestamp;
        // Clamp the error timestamp to the span's timestamp
        const left = props.manager.computeRelativeLeftPositionFromOrigin(
          clamp(
            timestamp ? timestamp * 1e3 : props.node_space![0],
            props.node_space![0],
            props.node_space![0] + props.node_space![1]
          ),
          props.node_space!
        );

        return (
          <div
            key={i}
            className={`TraceIcon ${getTraceIssueSeverityClassName(error)}`}
            style={{left: left * 100 + '%'}}
          >
            <TraceIcons.Icon event={error} />
          </div>
        );
      })}
    </Fragment>
  );
}

interface TraceOccurenceIconsProps {
  manager: VirtualizedViewManager;
  node_space: [number, number] | null;
  occurrences: BaseNode['occurrences'];
}

export function TraceOccurenceIcons(props: TraceOccurenceIconsProps) {
  const occurrences = useMemo(() => {
    return [...props.occurrences];
  }, [props.occurrences]);

  if (!props.occurrences.size) {
    return null;
  }

  return (
    <Fragment>
      {occurrences.map((occurrence, i) => {
        const occurrence_start_timestamp =
          'start_timestamp' in occurrence ? occurrence.start_timestamp : occurrence.start;
        const icon_timestamp =
          'timestamp' in occurrence && occurrence.timestamp
            ? occurrence.timestamp * 1e3
            : occurrence_start_timestamp
              ? occurrence_start_timestamp * 1e3
              : props.node_space![0];
        // Clamp the occurrence's timestamp to the span's timestamp
        const left = props.manager.computeRelativeLeftPositionFromOrigin(
          clamp(
            icon_timestamp,
            props.node_space![0],
            props.node_space![0] + props.node_space![1]
          ),
          props.node_space!
        );

        return (
          <div
            key={i}
            className={`TraceIcon ${getTraceIssueSeverityClassName(occurrence)}`}
            style={{left: left * 100 + '%'}}
          >
            <TraceIcons.Icon event={occurrence} />
          </div>
        );
      })}
    </Fragment>
  );
}
