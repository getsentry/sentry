import React from 'react';
import {PlatformIcon} from 'platformicons';

import {ellipsize} from 'sentry/utils/string/ellipsize';
import {TraceIcons} from 'sentry/views/performance/newTraceDetails/traceIcons';
import type {EapSpanNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/eapSpanNode';
import {TraceBar} from 'sentry/views/performance/newTraceDetails/traceRow/traceBar';
import {
  maybeFocusTraceRow,
  TRACE_COUNT_FORMATTER,
  TraceChildrenButton,
  TraceRowConnectors,
  type TraceRowProps,
} from 'sentry/views/performance/newTraceDetails/traceRow/traceRow';
import {useOTelFriendlyUI} from 'sentry/views/performance/otlp/useOTelFriendlyUI';

export function TraceEAPSpanRow(props: TraceRowProps<EapSpanNode>) {
  const otelFriendlyUI = useOTelFriendlyUI();

  const spanId = props.node.id;

  const childrenCount = getChildrenCount(props.node);

  const icon = (
    <PlatformIcon platform={props.projects[props.node.projectSlug ?? ''] ?? 'default'} />
  );

  // Prefer description over name if it exists for OTel-friendly UI
  const description = otelFriendlyUI
    ? props.node.description || props.node.value.name
    : props.node.description;

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
                {childrenCount > 0 ? TRACE_COUNT_FORMATTER.format(childrenCount) : null}
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
            <span className="TraceDescription" title={description}>
              {description ? ellipsize(description, 100) : (spanId ?? 'unknown')}
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

function getChildrenCount(node: EapSpanNode) {
  if (node.value.is_transaction && !node.expanded) {
    return node.children.length - node.directVisibleChildren.length;
  }

  return node.children.length;
}
