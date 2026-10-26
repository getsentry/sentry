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
import {TraceIcons} from 'sentry/views/performance/traceDetails/traceIcons';
import type {EapSpanNode} from 'sentry/views/performance/traceDetails/traceModels/traceTreeNode/eapSpanNode';
import {TraceBar} from 'sentry/views/performance/traceDetails/traceRow/traceBar';
import {
  maybeFocusTraceRow,
  TRACE_COUNT_FORMATTER,
  TraceChildrenButton,
  TraceRowConnectors,
  type TraceRowProps,
} from 'sentry/views/performance/traceDetails/traceRow/traceRow';

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
      key={props.index}
      ref={r =>
        props.tabIndex === 0
          ? maybeFocusTraceRow(r, props.node, props.previouslyFocusedNodeRef)
          : undefined
      }
      tabIndex={props.tabIndex}
      className={`TraceRow ${props.rowSearchClassName} ${props.node.hasErrors ? props.node.maxIssueSeverity : props.node.hasHttpError ? 'warning' : ''}`}
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
                {childrenCount > 0 ? TRACE_COUNT_FORMATTER.format(childrenCount) : null}
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
            <span className="TraceDescription" title={description}>
              {description ? ellipsize(description, 100) : (spanId ?? 'unknown')}
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

function getChildrenCount(node: EapSpanNode) {
  if (node.value.is_transaction && !node.expanded) {
    return node.children.length - node.directVisibleChildren.length;
  }

  return node.children.length;
}
