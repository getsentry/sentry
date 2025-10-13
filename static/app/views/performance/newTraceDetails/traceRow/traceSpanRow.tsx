import React from 'react';
import {PlatformIcon} from 'platformicons';

import {IconSentry, IconTimer} from 'sentry/icons';
import {ellipsize} from 'sentry/utils/string/ellipsize';
import {
  isEAPSpanNode,
  isEAPTransactionNode,
  isSpanNode,
  isUptimeCheckNode,
  isUptimeCheckTimingNode,
} from 'sentry/views/performance/newTraceDetails/traceGuards';
import {TraceIcons} from 'sentry/views/performance/newTraceDetails/traceIcons';
import type {EapSpanNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/eapSpanNode';
import type {SpanNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/spanNode';
import type {UptimeCheckNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/uptimeCheckNode';
import type {UptimeCheckTimingNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/uptimeCheckTimingNode';
import {TraceBar} from 'sentry/views/performance/newTraceDetails/traceRow/traceBar';
import {
  maybeFocusTraceRow,
  TRACE_COUNT_FORMATTER,
  TraceChildrenButton,
  TraceRowConnectors,
  type TraceRowProps,
} from 'sentry/views/performance/newTraceDetails/traceRow/traceRow';
import {useOTelFriendlyUI} from 'sentry/views/performance/otlp/useOTelFriendlyUI';

const NO_PROFILES: any = [];

export function TraceSpanRow(
  props: TraceRowProps<SpanNode | EapSpanNode | UptimeCheckNode | UptimeCheckTimingNode>
) {
  const shouldUseOTelFriendlyUI = useOTelFriendlyUI();
  const childrenCount = getChildrenCount(props.node);

  const icon = isUptimeCheckNode(props.node) ? (
    <IconSentry size="xs" />
  ) : isUptimeCheckTimingNode(props.node) ? (
    <IconTimer size="xs" />
  ) : (
    <PlatformIcon platform={props.projects[props.node.projectSlug ?? ''] ?? 'default'} />
  );

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
            {shouldUseOTelFriendlyUI &&
            isEAPSpanNode(props.node) &&
            props.node.value.name &&
            props.node.value.name !== props.node.value.op ? (
              <React.Fragment>
                <span className="TraceName" title={props.node.value.name}>
                  {ellipsize(props.node.value.name, 100)}
                </span>
              </React.Fragment>
            ) : (
              <span className="TraceDescription" title={props.node.value.description}>
                {isSpanNode(props.node) &&
                props.node.value.data?.['http.request.prefetch']
                  ? '(prefetch) '
                  : ''}
                {props.node.value.description
                  ? ellipsize(props.node.value.description, 100)
                  : (props.node.id ?? 'unknown')}
              </span>
            )}
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

function getChildrenCount(
  node: SpanNode | EapSpanNode | UptimeCheckNode | UptimeCheckTimingNode
) {
  if (isUptimeCheckTimingNode(node)) {
    return 0;
  }

  if (isEAPTransactionNode(node) && !node.expanded) {
    return node.children.length - node.directVisibleChildren.length;
  }

  return node.children.length;
}
