import {isEAPSpanNode} from 'sentry/views/performance/newTraceDetails/traceGuards';
import {SpanProjectIcon} from 'sentry/views/performance/newTraceDetails/traceRow/traceIcons';

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

const NO_PROFILES: any = [];

export function TraceSpanRow(
  props: TraceRowProps<TraceTreeNode<TraceTree.Span> | TraceTreeNode<TraceTree.EAPSpan>>
) {
  const spanId = isEAPSpanNode(props.node)
    ? props.node.value.event_id
    : props.node.value.span_id;

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
            {props.node.children.length > 0 || props.node.canFetch ? (
              <TraceChildrenButton
                icon={
                  props.node.canFetch ? (
                    '+'
                  ) : (
                    <TraceIcons.Chevron direction={props.node.expanded ? 'up' : 'down'} />
                  )
                }
                status={props.node.fetchStatus}
                expanded={props.node.expanded || props.node.zoomedIn}
                onDoubleClick={props.onExpandDoubleClick}
                onClick={e =>
                  props.node.canFetch ? props.onZoomIn(e) : props.onExpand(e)
                }
              >
                {props.node.children.length > 0
                  ? TRACE_COUNT_FORMATTER.format(props.node.children.length)
                  : null}
              </TraceChildrenButton>
            ) : null}
          </div>
          <SpanProjectIcon
            platform={props.projects[props.node.metadata.project_slug ?? ''] ?? 'default'}
          />
          <span className="TraceOperation">{props.node.value.op ?? '<unknown>'}</span>
          <strong className="TraceEmDash"> — </strong>
          <span className="TraceDescription" title={props.node.value.description}>
            {!props.node.value.description
              ? spanId ?? 'unknown'
              : props.node.value.description.length > 100
                ? props.node.value.description.slice(0, 100).trim() + '\u2026'
                : props.node.value.description}
          </span>
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
          profiles={NO_PROFILES}
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
