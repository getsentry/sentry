import {Fragment} from 'react';
import {PlatformIcon} from 'platformicons';

import {ellipsize} from 'sentry/utils/string/ellipsize';
import {
  getToolInputPreview,
  getStringAttr,
} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
import {
  GenAiOperationType,
  getGenAiOperationTypeFromSpanName,
} from 'sentry/views/insights/pages/agents/utils/query';
import {SpanFields} from 'sentry/views/insights/types';
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

/**
 * Returns an enriched description for AI spans when attributes are available.
 * - Tool spans: "toolName: inputPreview"
 * - AI client spans: responseModel (e.g., "gpt-4o")
 * Falls back to undefined so the caller can use the default description.
 */
function getAIEnhancedDescription(node: EapSpanNode): string | undefined {
  const attrs = node.attributes;
  if (!attrs) {
    return undefined;
  }

  const opType =
    (attrs[SpanFields.GEN_AI_OPERATION_TYPE] as string | undefined) ??
    getGenAiOperationTypeFromSpanName(node.value.name);

  if (!opType) {
    return undefined;
  }

  if (opType === GenAiOperationType.TOOL) {
    const toolName = getStringAttr(node, SpanFields.GEN_AI_TOOL_NAME);
    const inputPreview = getToolInputPreview(node);
    if (toolName && inputPreview) {
      return `${toolName}: ${inputPreview}`;
    }
    return toolName ?? undefined;
  }

  if (opType === GenAiOperationType.AI_CLIENT) {
    const responseModel = getStringAttr(node, SpanFields.GEN_AI_RESPONSE_MODEL);
    return responseModel ?? undefined;
  }

  return undefined;
}

export function TraceEAPSpanRow(props: TraceRowProps<EapSpanNode>) {
  const spanId = props.node.id;

  const childrenCount = getChildrenCount(props.node);

  const icon = (
    <PlatformIcon platform={props.projects[props.node.projectSlug ?? ''] ?? 'default'} />
  );

  const description =
    getAIEnhancedDescription(props.node) ||
    props.node.description ||
    props.node.value.name;

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
      className={`TraceRow ${props.rowSearchClassName} ${props.node.hasErrors ? props.node.maxIssueSeverity : props.node.hasHttpError ? 'warning' : ''}`}
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
                {childrenCount > 0 ? TRACE_COUNT_FORMATTER.format(childrenCount) : null}
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
            <span className="TraceDescription" title={description}>
              {/* oxlint-disable-next-line react/refs */}
              {description ? ellipsize(description, 100) : (spanId ?? 'unknown')}
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

function getChildrenCount(node: EapSpanNode) {
  if (node.value.is_transaction && !node.expanded) {
    return node.children.length - node.directVisibleChildren.length;
  }

  return node.children.length;
}
