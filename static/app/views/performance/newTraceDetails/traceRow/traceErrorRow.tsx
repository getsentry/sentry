import {PlatformIcon} from 'platformicons';

import {t} from 'sentry/locale';
import type {Level} from 'sentry/types/event';
import {TraceIcons} from 'sentry/views/performance/newTraceDetails/traceIcons';
import type {ErrorNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/errorNode';
import {InvisibleTraceBar} from 'sentry/views/performance/newTraceDetails/traceRow/traceBar';
import {
  maybeFocusTraceRow,
  TraceRowConnectors,
  type TraceRowProps,
} from 'sentry/views/performance/newTraceDetails/traceRow/traceRow';

const ERROR_LEVEL_LABELS: Record<Level | 'default', string> = {
  sample: t('Sample'),
  info: t('Info'),
  warning: t('Warning'),
  error: t('Error'),
  fatal: t('Fatal'),
  default: t('Default'),
  unknown: t('Unknown'),
};

export function TraceErrorRow(props: TraceRowProps<ErrorNode>) {
  const description = props.node.description;
  const timestamp = props.node.space[0];

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
      className={`TraceRow ${props.rowSearchClassName} ${props.node.maxIssueSeverity}`}
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
          <div className="TraceChildrenCountWrapper">
            {/* oxlint-disable-next-line react/refs */}
            <TraceRowConnectors node={props.node} manager={props.manager} />{' '}
          </div>
          <PlatformIcon
            // oxlint-disable-next-line react/refs
            platform={props.projects[props.node.value.project_slug] ?? 'default'}
          />
          <span className="TraceOperation">
            {/* oxlint-disable-next-line react/refs */}
            {ERROR_LEVEL_LABELS[props.node.value.level ?? 'error']}
          </span>
          <strong className="TraceEmDash"> — </strong>
          {/* oxlint-disable-next-line react/refs */}
          <span className="TraceDescription">{description}</span>
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
        <InvisibleTraceBar
          // oxlint-disable-next-line react/refs
          node_space={props.node.space}
          // oxlint-disable-next-line react/refs
          manager={props.manager}
          // oxlint-disable-next-line react/refs
          virtualizedIndex={props.virtualized_index}
        >
          {/* oxlint-disable-next-line react/refs */}
          {typeof timestamp === 'number' ? (
            // oxlint-disable-next-line react/refs
            <div className={`TraceIcon ${props.node.value.level}`}>
              {/* oxlint-disable-next-line react/refs */}
              <TraceIcons.Icon event={props.node.value} />
            </div>
          ) : null}
        </InvisibleTraceBar>
      </div>
    </div>
  );
}
