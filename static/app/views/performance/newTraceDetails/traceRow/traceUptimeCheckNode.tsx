import React from 'react';

import {IconSentry} from 'sentry/icons';
import {ellipsize} from 'sentry/utils/string/ellipsize';
import {TraceIcons} from 'sentry/views/performance/newTraceDetails/traceIcons';
import type {UptimeCheckNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/uptimeCheckNode';
import {TraceBar} from 'sentry/views/performance/newTraceDetails/traceRow/traceBar';
import {
  maybeFocusTraceRow,
  TRACE_COUNT_FORMATTER,
  TraceChildrenButton,
  TraceRowConnectors,
  type TraceRowProps,
} from 'sentry/views/performance/newTraceDetails/traceRow/traceRow';

export function TraceUptimeCheckNodeRow(props: TraceRowProps<UptimeCheckNode>) {
  const spanId = props.node.id;

  const icon = <IconSentry size="xs" />;

  return (
    <div
      key={props.index}
      ref={r =>
        props.tabIndex === 0
          ? maybeFocusTraceRow(r, props.node, props.previouslyFocusedNodeRef)
          : undefined
      }
      tabIndex={props.tabIndex}
      className={`TraceRow ${props.rowSearchClassName} ${props.node.hasErrors ? props.node.maxIssueSeverity : ''}`}
      onPointerDown={props.onRowClick}
      onKeyDown={props.onRowKeyDown}
      style={props.style}
    >
      <div
        className="TraceLeftColumn"
        ref={props.registerListColumnRef}
        onDoubleClick={props.onRowDoubleClick}
      >
        <div className="TraceLeftColumnInner" style={props.listColumnStyle}>
          <div className={props.listColumnClassName}>
            <TraceRowConnectors node={props.node} manager={props.manager} />
            {props.node.children.length > 0 || props.node.canFetchChildren ? (
              <TraceChildrenButton
                icon={
                  props.node.canFetchChildren ? (
                    '+'
                  ) : (
                    <TraceIcons.Chevron direction={props.node.expanded ? 'up' : 'down'} />
                  )
                }
                status={props.node.fetchStatus}
                expanded={props.node.expanded || props.node.hasFetchedChildren}
                onDoubleClick={props.onExpandDoubleClick}
                onClick={e =>
                  props.node.canFetchChildren ? props.onZoomIn(e) : props.onExpand(e)
                }
              >
                {props.node.children.length > 0
                  ? TRACE_COUNT_FORMATTER.format(props.node.children.length)
                  : null}
              </TraceChildrenButton>
            ) : null}
          </div>
          {icon}
          <React.Fragment>
            {props.node.value.op && props.node.value.op !== 'default' && (
              <React.Fragment>
                <span className="TraceOperation">{props.node.value.op}</span>
                <strong className="TraceEmDash"> — </strong>
              </React.Fragment>
            )}
            <span className="TraceDescription" title={props.node.description}>
              {props.node.description
                ? ellipsize(props.node.description, 100)
                : (spanId ?? 'unknown')}
            </span>
          </React.Fragment>
        </div>
      </div>
      <div
        ref={props.registerSpanColumnRef}
        className={props.spanColumnClassName}
        onDoubleClick={props.onRowDoubleClick}
      >
        <TraceBar
          node={props.node}
          virtualized_index={props.virtualized_index}
          manager={props.manager}
          color={props.node.makeBarColor(props.theme)}
          node_space={props.node.space}
          errors={props.node.errors}
          occurrences={props.node.occurrences}
        />
        <button
          ref={props.registerSpanArrowRef}
          className="TraceArrow"
          onClick={props.onSpanArrowClick}
        >
          <TraceIcons.Chevron direction="left" />
        </button>
      </div>
    </div>
  );
}
