import {Fragment} from 'react';

import {IconTimer} from 'sentry/icons';
import {ellipsize} from 'sentry/utils/string/ellipsize';
import {TraceIcons} from 'sentry/views/performance/newTraceDetails/traceIcons';
import type {UptimeCheckTimingNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/uptimeCheckTimingNode';
import {TraceBar} from 'sentry/views/performance/newTraceDetails/traceRow/traceBar';
import {
  maybeFocusTraceRow,
  TRACE_COUNT_FORMATTER,
  TraceChildrenButton,
  TraceRowConnectors,
  type TraceRowProps,
} from 'sentry/views/performance/newTraceDetails/traceRow/traceRow';

export function TraceUptimeCheckTimingNodeRow(
  props: TraceRowProps<UptimeCheckTimingNode>
) {
  const icon = <IconTimer size="xs" />;

  return (
    <div
      // oxlint-disable-next-line react/refs
      key={props.index}
      ref={r =>
        props.tabIndex === 0
          ? maybeFocusTraceRow(r, props.node, props.previouslyFocusedNodeRef)
          : undefined
      }
      // oxlint-disable-next-line react/refs
      tabIndex={props.tabIndex}
      className={`TraceRow ${props.rowSearchClassName} ${props.node.hasErrors ? props.node.maxIssueSeverity : ''}`}
      // oxlint-disable-next-line react/refs
      onPointerDown={props.onRowClick}
      // oxlint-disable-next-line react/refs
      onKeyDown={props.onRowKeyDown}
      // oxlint-disable-next-line react/refs
      style={props.style}
    >
      <div
        className="TraceLeftColumn"
        // oxlint-disable-next-line react/refs
        ref={props.registerListColumnRef}
        // oxlint-disable-next-line react/refs
        onDoubleClick={props.onRowDoubleClick}
      >
        {/* oxlint-disable-next-line react/refs */}
        <div className="TraceLeftColumnInner" style={props.listColumnStyle}>
          {/* oxlint-disable-next-line react/refs */}
          <div className={props.listColumnClassName}>
            {/* oxlint-disable-next-line react/refs */}
            <TraceRowConnectors node={props.node} manager={props.manager} />
            {/* oxlint-disable-next-line react/refs */}
            {props.node.children.length > 0 || props.node.canFetchChildren ? (
              <TraceChildrenButton
                icon={
                  // oxlint-disable-next-line react/refs
                  props.node.canFetchChildren ? (
                    '+'
                  ) : (
                    <TraceIcons.Chevron
                      // oxlint-disable-next-line react/refs
                      direction={props.node.expanded ? 'down' : 'right'}
                    />
                  )
                }
                // oxlint-disable-next-line react/refs
                status={props.node.fetchStatus}
                // oxlint-disable-next-line react/refs
                expanded={props.node.expanded || props.node.hasFetchedChildren}
                // oxlint-disable-next-line react/refs
                onDoubleClick={props.onExpandDoubleClick}
                onClick={e =>
                  props.node.canFetchChildren ? props.onZoomIn(e) : props.onExpand(e)
                }
              >
                {/* oxlint-disable-next-line react/refs */}
                {props.node.children.length > 0
                  ? // oxlint-disable-next-line react/refs
                    TRACE_COUNT_FORMATTER.format(props.node.children.length)
                  : null}
              </TraceChildrenButton>
            ) : null}
          </div>
          {icon}
          <Fragment>
            {/* oxlint-disable-next-line react/refs */}
            {props.node.value.op && props.node.value.op !== 'default' && (
              <Fragment>
                {/* oxlint-disable-next-line react/refs */}
                <span className="TraceOperation">{props.node.value.op}</span>
                <strong className="TraceEmDash"> — </strong>
              </Fragment>
            )}
            {/* oxlint-disable-next-line react/refs */}
            <span className="TraceDescription" title={props.node.description}>
              {/* oxlint-disable-next-line react/refs */}
              {props.node.description
                ? // oxlint-disable-next-line react/refs
                  ellipsize(props.node.description, 100)
                : // oxlint-disable-next-line react/refs
                  (props.node.id ?? 'unknown')}
            </span>
          </Fragment>
        </div>
      </div>
      <div
        // oxlint-disable-next-line react/refs
        ref={props.registerSpanColumnRef}
        // oxlint-disable-next-line react/refs
        className={props.spanColumnClassName}
        // oxlint-disable-next-line react/refs
        onDoubleClick={props.onRowDoubleClick}
      >
        <TraceBar
          // oxlint-disable-next-line react/refs
          node={props.node}
          // oxlint-disable-next-line react/refs
          virtualized_index={props.virtualized_index}
          // oxlint-disable-next-line react/refs
          manager={props.manager}
          // oxlint-disable-next-line react/refs
          color={props.node.makeBarColor(props.theme)}
          // oxlint-disable-next-line react/refs
          node_space={props.node.space}
          // oxlint-disable-next-line react/refs
          errors={props.node.errors}
          // oxlint-disable-next-line react/refs
          occurrences={props.node.occurrences}
        />
        <button
          // oxlint-disable-next-line react/refs
          ref={props.registerSpanArrowRef}
          className="TraceArrow"
          // oxlint-disable-next-line react/refs
          onClick={props.onSpanArrowClick}
        >
          <TraceIcons.Chevron direction="left" />
        </button>
      </div>
    </div>
  );
}
