import {Fragment, useMemo} from 'react';
import clamp from 'lodash/clamp';
import {PlatformIcon} from 'platformicons';

import {isEAPError} from 'sentry/views/performance/newTraceDetails/traceGuards';
import {TraceIcons} from 'sentry/views/performance/newTraceDetails/traceIcons';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceTreeNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode';
import type {VirtualizedViewManager} from 'sentry/views/performance/newTraceDetails/traceRenderers/virtualizedViewManager';
import {useHasTraceNewUi} from 'sentry/views/performance/newTraceDetails/useHasTraceNewUi';

interface ErrorIconsProps {
  errors: TraceTreeNode<TraceTree.Transaction>['errors'];
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
        const timestamp = isEAPError(error) ? error.start_timestamp : error.timestamp;
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
            className={`TraceIcon ${error.level}`}
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
  occurrences: TraceTreeNode<TraceTree.Transaction>['occurrences'];
}

export function TraceOccurenceIcons(props: TraceOccurenceIconsProps) {
  const occurences = useMemo(() => {
    return [...props.occurrences];
  }, [props.occurrences]);

  if (!props.occurrences.size) {
    return null;
  }

  return (
    <Fragment>
      {occurences.map((occurence, i) => {
        const occurence_start_timestamp =
          'start_timestamp' in occurence ? occurence.start_timestamp : occurence.start;
        const icon_timestamp =
          'timestamp' in occurence && occurence.timestamp
            ? occurence.timestamp * 1e3
            : occurence_start_timestamp
              ? occurence_start_timestamp * 1e3
              : props.node_space![0];
        // Clamp the occurence's timestamp to the span's timestamp
        const left = props.manager.computeRelativeLeftPositionFromOrigin(
          clamp(
            icon_timestamp,
            props.node_space![0],
            props.node_space![0] + props.node_space![1]
          ),
          props.node_space!
        );

        return (
          <div key={i} className={`TraceIcon occurence`} style={{left: left * 100 + '%'}}>
            <TraceIcons.Icon event={occurence} />
          </div>
        );
      })}
    </Fragment>
  );
}

export function SpanProjectIcon({platform}: {platform: string}) {
  const hasTraceNewUi = useHasTraceNewUi();

  if (!hasTraceNewUi) {
    return null;
  }

  return <PlatformIcon platform={platform} />;
}
