import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import type {ServerRenderNode} from 'sentry/views/performance/traceDetails/traceModels/traceTreeNode/serverRenderNode';

import {maybeFocusTraceRow, TraceRowConnectors, type TraceRowProps} from './traceRow';

/**
 * The render can be hours older than this page load, so the row draws no bar.
 * A pattern fills the timeline column instead, and the text says why.
 */
export function TraceServerRenderRow(props: TraceRowProps<ServerRenderNode>) {
  return (
    <div
      key={props.index}
      ref={r =>
        props.tabIndex === 0
          ? maybeFocusTraceRow(r, props.node, props.previouslyFocusedNodeRef)
          : undefined
      }
      tabIndex={props.tabIndex}
      className={`TraceRow ${props.rowSearchClassName}`}
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
          <div className="TraceChildrenCountWrapper">
            <TraceRowConnectors node={props.node} manager={props.manager} />
          </div>
          <span className="TraceOperation">{props.node.description}</span>
          <strong className="TraceEmDash"> — </strong>
          <span className="TraceDescription">{t('spans not in this trace')}</span>
        </div>
      </div>
      {props.pinnedAttributeCell}
      <div ref={props.registerSpanColumnRef} className={props.spanColumnClassName}>
        <OutsideTimeline position="absolute" align="center" paddingLeft="md">
          <Text size="xs" variant="muted" wrap="nowrap">
            {t('Rendered earlier: not on this timeline')}
          </Text>
        </OutsideTimeline>
      </div>
    </div>
  );
}

/** Fills the whole timeline column, so it marks no point in time. */
const OutsideTimeline = styled(Flex)`
  inset: 0;
  background: repeating-linear-gradient(
    135deg,
    transparent 0 6px,
    ${p => p.theme.tokens.background.tertiary} 6px 12px
  );
`;
