import {Fragment, useMemo} from 'react';

import {getTraceIssueSeverityClassName} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/utils';
import {TraceIcons} from 'sentry/views/performance/newTraceDetails/traceIcons';
import {
  getRenderableTraceIssues,
  getTraceIconGroupWidth,
  getTraceIssueTimestamp,
  TRACE_ICON_WIDTH,
} from 'sentry/views/performance/newTraceDetails/traceIssueUtils';
import type {BaseNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/baseNode';
import type {VirtualizedViewManager} from 'sentry/views/performance/newTraceDetails/traceRenderers/virtualizedViewManager';

interface TraceIssueIconsProps {
  errors: BaseNode['errors'];
  manager: VirtualizedViewManager;
  node: BaseNode;
  node_space: [number, number] | null;
  occurrences: BaseNode['occurrences'];
}

export function TraceIssueIcons(props: TraceIssueIconsProps) {
  const issues = useMemo(() => {
    return getRenderableTraceIssues(
      props.node,
      props.errors,
      props.occurrences,
      props.node_space
    );
  }, [props.node, props.errors, props.occurrences, props.node_space]);

  if (!issues.length || !props.node_space) {
    return null;
  }

  const node_space = props.node_space;

  return (
    <Fragment>
      {issues.map(({issue, additionalIssueCount}, i) => {
        const timestamp = getTraceIssueTimestamp(issue, node_space);
        const className = getTraceIssueSeverityClassName(issue);

        if (additionalIssueCount !== undefined) {
          const width = getTraceIconGroupWidth(additionalIssueCount, text =>
            props.manager.text_measurer.measure(text)
          );
          const {edge, anchorTimestamp} = props.manager.computeTraceIconPlacement(
            timestamp,
            width,
            node_space
          );
          const left = props.manager.computeRelativeLeftPositionFromOrigin(
            anchorTimestamp,
            node_space
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
                {additionalIssueCount}
              </span>
            </div>
          );
        }

        const {edge, anchorTimestamp} = props.manager.computeTraceIconPlacement(
          timestamp,
          TRACE_ICON_WIDTH,
          node_space
        );
        const left = props.manager.computeRelativeLeftPositionFromOrigin(
          anchorTimestamp,
          node_space
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
