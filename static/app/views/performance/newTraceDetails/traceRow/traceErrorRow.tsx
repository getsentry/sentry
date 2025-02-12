import type {Theme} from '@emotion/react';
import {PlatformIcon} from 'platformicons';

import {t} from 'sentry/locale';

import {TraceIcons} from '../traceIcons';
import type {TraceTree} from '../traceModels/traceTree';
import type {TraceTreeNode} from '../traceModels/traceTreeNode';
import {InvisibleTraceBar} from '../traceRow/traceBar';
import {
  maybeFocusTraceRow,
  TraceRowConnectors,
  type TraceRowProps,
} from '../traceRow/traceRow';

const ERROR_LEVEL_LABELS: Record<keyof Theme['level'], string> = {
  sample: t('Sample'),
  info: t('Info'),
  warning: t('Warning'),
  // Hardcoded legacy color (orange400). We no longer use orange anywhere
  // else in the app (except for the chart palette). This needs to be harcoded
  // here because existing users may still associate orange with the "error" level.
  error: t('Error'),
  fatal: t('Fatal'),
  default: t('Default'),
  unknown: t('Unknown'),
};

export function TraceErrorRow(props: TraceRowProps<TraceTreeNode<TraceTree.TraceError>>) {
  return (
    <div
      key={props.index}
      ref={r =>
        props.tabIndex === 0
          ? maybeFocusTraceRow(r, props.node, props.previouslyFocusedNodeRef)
          : null
      }
      tabIndex={props.tabIndex}
      className={`TraceRow ${props.rowSearchClassName} ${props.node.maxIssueSeverity}`}
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
          <div className="TraceChildrenCountWrapper">
            <TraceRowConnectors node={props.node} manager={props.manager} />{' '}
          </div>
          <PlatformIcon
            platform={props.projects[props.node.value.project_slug] ?? 'default'}
          />
          <span className="TraceOperation">
            {ERROR_LEVEL_LABELS[props.node.value.level ?? 'error']}
          </span>
          <strong className="TraceEmDash"> — </strong>
          <span className="TraceDescription">
            {props.node.value.message ?? props.node.value.title}
          </span>
        </div>
      </div>
      <div
        ref={props.registerSpanColumnRef}
        className={props.spanColumnClassName}
        onDoubleClick={props.onRowDoubleClick}
      >
        <InvisibleTraceBar
          node_space={props.node.space}
          manager={props.manager}
          virtualizedIndex={props.virtualized_index}
        >
          {typeof props.node.value.timestamp === 'number' ? (
            <div className={`TraceIcon ${props.node.value.level}`}>
              <TraceIcons.Icon event={props.node.value} />
            </div>
          ) : null}
        </InvisibleTraceBar>
      </div>
    </div>
  );
}
