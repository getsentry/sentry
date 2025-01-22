import {PlatformIcon} from 'platformicons';

import {TraceIcons} from '../traceIcons';
import type {TraceTree} from '../traceModels/traceTree';
import type {TraceTreeNode} from '../traceModels/traceTreeNode';
import {makeTraceNodeBarColor, TraceBar} from '../traceRow/traceBar';
import {
  maybeFocusTraceRow,
  TRACE_COUNT_FORMATTER,
  TraceChildrenButton,
  TraceRowConnectors,
  type TraceRowProps,
} from '../traceRow/traceRow';

export function TraceTransactionRow(
  props: TraceRowProps<TraceTreeNode<TraceTree.Transaction>>
) {
  return (
    <div
      key={props.index}
      ref={r =>
        props.tabIndex === 0
          ? maybeFocusTraceRow(r, props.node, props.previouslyFocusedNodeRef)
          : null
      }
      tabIndex={props.tabIndex}
      className={`TraceRow ${props.rowSearchClassName} ${props.node.hasErrors ? props.node.maxIssueSeverity : ''}`}
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
            {props.node.children.length > 0 || props.node.canFetch ? (
              <TraceChildrenButton
                icon={
                  props.node.canFetch ? (
                    props.node.fetchStatus === 'idle' ? (
                      '+'
                    ) : props.node.zoomedIn ? (
                      <TraceIcons.Chevron direction="up" />
                    ) : (
                      '+'
                    )
                  ) : (
                    <TraceIcons.Chevron direction={props.node.expanded ? 'up' : 'down'} />
                  )
                }
                status={props.node.fetchStatus}
                expanded={props.node.expanded || props.node.zoomedIn}
                onDoubleClick={props.onExpandDoubleClick}
                onClick={e => {
                  if (props.node.canFetch) {
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
          <span className="TraceOperation">{props.node.value['transaction.op']}</span>
          <strong className="TraceEmDash"> — </strong>
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
          color={makeTraceNodeBarColor(props.theme, props.node)}
          node_space={props.node.space}
          errors={props.node.errors}
          performance_issues={props.node.performance_issues}
          profiles={props.node.profiles}
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
