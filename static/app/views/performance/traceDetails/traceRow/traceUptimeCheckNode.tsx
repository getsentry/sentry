import {Fragment} from 'react';
import {IconSentry} from '@sentry/icons/sentry';

import {ellipsize} from 'sentry/utils/string/ellipsize';
import {TraceIcons} from 'sentry/views/performance/traceDetails/traceIcons';
import type {UptimeCheckNode} from 'sentry/views/performance/traceDetails/traceModels/traceTreeNode/uptimeCheckNode';
import {TraceBar} from 'sentry/views/performance/traceDetails/traceRow/traceBar';
import {
  maybeFocusTraceRow,
  TRACE_COUNT_FORMATTER,
  TraceChildrenButton,
  TraceRowConnectors,
  type TraceRowProps,
} from 'sentry/views/performance/traceDetails/traceRow/traceRow';

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
        // oxlint-disable-next-line react/refs
        onDoubleClick={props.onRowDoubleClick}
      >
        <div className="TraceLeftColumnInner" style={props.listColumnStyle}>
          <div className={props.listColumnClassName}>
            <TraceRowConnectors node={props.node} manager={props.manager} />
            {props.node.children.length > 0 ? (
              <TraceChildrenButton
                icon={
                  <TraceIcons.Chevron
                    direction={props.node.expanded ? 'down' : 'right'}
                  />
                }
                onDoubleClick={props.onExpandDoubleClick}
                onClick={props.onExpand}
              >
                {props.node.children.length > 0
                  ? TRACE_COUNT_FORMATTER.format(props.node.children.length)
                  : null}
              </TraceChildrenButton>
            ) : null}
          </div>
          {icon}
          <Fragment>
            {props.node.value.op && props.node.value.op !== 'default' && (
              <Fragment>
                <span className="TraceOperation">{props.node.value.op}</span>
                <strong className="TraceEmDash"> — </strong>
              </Fragment>
            )}
            <span className="TraceDescription" title={props.node.description}>
              {props.node.description
                ? ellipsize(props.node.description, 100)
                : (spanId ?? 'unknown')}
            </span>
          </Fragment>
        </div>
      </div>
      {props.pinnedAttributeCell}
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
