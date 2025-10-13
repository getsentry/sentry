import React from 'react';
import {PlatformIcon} from 'platformicons';

import {TraceIcons} from 'sentry/views/performance/newTraceDetails/traceIcons';
import type {TransactionNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/transactionNode';
import {TraceBar} from 'sentry/views/performance/newTraceDetails/traceRow/traceBar';
import {
  maybeFocusTraceRow,
  TRACE_COUNT_FORMATTER,
  TraceChildrenButton,
  TraceRowConnectors,
  type TraceRowProps,
} from 'sentry/views/performance/newTraceDetails/traceRow/traceRow';

export function TraceTransactionRow(props: TraceRowProps<TransactionNode>) {
  return (
    <div
      key={props.index}
      ref={r =>
        props.tabIndex === 0
          ? maybeFocusTraceRow(r, props.node, props.previouslyFocusedNodeRef)
          : undefined
      }
      tabIndex={props.tabIndex}
      className={`TraceRow ${props.rowSearchClassName} ${props.node.errors.size > 0 ? props.node.maxIssueSeverity : ''}`}
      onKeyDown={props.onRowKeyDown}
      onPointerDown={props.onRowClick}
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
                    props.node.fetchStatus === 'idle' ? (
                      '+'
                    ) : props.node.hasFetchedChildren ? (
                      <TraceIcons.Chevron direction="up" />
                    ) : (
                      '+'
                    )
                  ) : (
                    <TraceIcons.Chevron direction={props.node.expanded ? 'up' : 'down'} />
                  )
                }
                status={props.node.fetchStatus}
                expanded={props.node.expanded || props.node.hasFetchedChildren}
                onDoubleClick={props.onExpandDoubleClick}
                onClick={e => {
                  if (props.node.canFetchChildren) {
                    props.onZoomIn(e);
                  } else {
                    props.onExpand(e);
                  }
                }}
              >
                {props.node.children.length > 0
                  ? TRACE_COUNT_FORMATTER.format(props.node.children.length)
                  : null}
              </TraceChildrenButton>
            ) : null}
          </div>
          <PlatformIcon
            platform={props.projects[props.node.value.project_slug] ?? 'default'}
          />
          {props.node.value['transaction.op'] !== 'default' && (
            <React.Fragment>
              <span className="TraceOperation">{props.node.value['transaction.op']}</span>
              <strong className="TraceEmDash"> — </strong>
            </React.Fragment>
          )}
          <span className="TraceDescription">{props.node.value.transaction}</span>
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
          profiles={Array.from(props.node.profiles)}
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
