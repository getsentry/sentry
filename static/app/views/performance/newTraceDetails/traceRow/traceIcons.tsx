import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';
import clamp from 'lodash/clamp';
import {PlatformIcon} from 'platformicons';

import {useHasTraceNewUi} from 'sentry/views/performance/newTraceDetails/useHasTraceNewUi';

import {TraceIcons} from '../traceIcons';
import type {TraceTree} from '../traceModels/traceTree';
import type {TraceTreeNode} from '../traceModels/traceTreeNode';
import type {VirtualizedViewManager} from '../traceRenderers/virtualizedViewManager';

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
        const timestamp = error.timestamp ? error.timestamp * 1e3 : props.node_space![0];
        // Clamp the error timestamp to the span's timestamp
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

interface TracePerformanceIssueIconsProps {
  manager: VirtualizedViewManager;
  node_space: [number, number] | null;
  performance_issues: TraceTreeNode<TraceTree.Transaction>['performance_issues'];
}

export function TracePerformanceIssueIcons(props: TracePerformanceIssueIconsProps) {
  const performance_issues = useMemo(() => {
    return [...props.performance_issues];
  }, [props.performance_issues]);

  if (!props.performance_issues.size) {
    return null;
  }

  return (
    <Fragment>
      {performance_issues.map((issue, i) => {
        const timestamp = issue.timestamp
          ? issue.timestamp * 1e3
          : issue.start
            ? issue.start * 1e3
            : props.node_space![0];
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
            className={`TraceIcon performance_issue`}
            style={{left: left * 100 + '%'}}
          >
            <TraceIcons.Icon event={issue} />
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

  return <FaintProjectIcon platform={platform} />;
}

const FaintProjectIcon = styled(PlatformIcon)`
  opacity: 0.2;
  filter: grayscale(1);
`;
