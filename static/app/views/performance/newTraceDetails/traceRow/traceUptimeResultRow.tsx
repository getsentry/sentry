import React from 'react';
import {PlatformIcon} from 'platformicons';

import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceTreeNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode';
import {
  makeTraceNodeBarColor,
  TraceBar,
} from 'sentry/views/performance/newTraceDetails/traceRow/traceBar';
import {
  maybeFocusTraceRow,
  TraceRowConnectors,
  type TraceRowProps,
} from 'sentry/views/performance/newTraceDetails/traceRow/traceRow';

export function TraceUptimeResultRow(
  props: TraceRowProps<TraceTreeNode<TraceTree.EAPUptimeResult>>
) {
  const uptimeResult = props.node.value;

  // Create a description for the uptime check
  const description =
    uptimeResult.request_url ||
    `Uptime check (${uptimeResult.subscription_id.slice(0, 8)})`;

  // Determine the status icon and color
  const getStatusIcon = () => {
    switch (uptimeResult.check_status) {
      case 'success':
        return (
          <svg
            viewBox="0 0 16 16"
            style={{width: 12, height: 12, fill: 'var(--green400)'}}
          >
            <path d="M8,16a8,8,0,1,1,8-8A8,8,0,0,1,8,16ZM8,1.5A6.5,6.5,0,1,0,14.5,8,6.51,6.51,0,0,0,8,1.5Zm3.28,4.22L7.11,9.89,4.72,7.5A.75.75,0,0,0,3.66,8.56l3,3a.75.75,0,0,0,1.06,0l5-5a.75.75,0,0,0-1.06-1.06Z" />
          </svg>
        );
      case 'failure':
        return (
          <svg viewBox="0 0 16 16" style={{width: 12, height: 12, fill: 'var(--red400)'}}>
            <path d="M8,16a8,8,0,1,1,8-8A8,8,0,0,1,8,16ZM8,1.5A6.5,6.5,0,1,0,14.5,8,6.51,6.51,0,0,0,8,1.5Zm2.78,4.72L9.06,8l1.72,1.78a.75.75,0,0,1-1.06,1.06L8,9.06,6.28,10.84a.75.75,0,0,1-1.06-1.06L6.94,8,5.22,6.22A.75.75,0,0,1,6.28,5.16L8,6.94,9.72,5.16a.75.75,0,0,1,1.06,1.06Z" />
          </svg>
        );
      case 'missed_window':
        return (
          <svg
            viewBox="0 0 16 16"
            style={{width: 12, height: 12, fill: 'var(--yellow400)'}}
          >
            <path d="M8,16a8,8,0,1,1,8-8A8,8,0,0,1,8,16ZM8,1.5A6.5,6.5,0,1,0,14.5,8,6.51,6.51,0,0,0,8,1.5ZM8,4a.75.75,0,0,1,.75.75v2.69l1.72,1.16a.75.75,0,0,1-.84,1.24L8,8.75a.75.75,0,0,1-.25-.6V4.75A.75.75,0,0,1,8,4Z" />
          </svg>
        );
      default:
        return (
          <svg
            viewBox="0 0 16 16"
            style={{width: 12, height: 12, fill: 'var(--gray400)'}}
          >
            <path d="M8,16a8,8,0,1,1,8-8A8,8,0,0,1,8,16ZM8,1.5A6.5,6.5,0,1,0,14.5,8,6.51,6.51,0,0,0,8,1.5ZM8,4a.75.75,0,0,1,.75.75v3.5a.75.75,0,0,1-1.5,0v-3.5A.75.75,0,0,1,8,4ZM8.75,11.25a.75.75,0,1,1-1.5,0,.75.75,0,0,1,1.5,0Z" />
          </svg>
        );
    }
  };

  const getStatusText = () => {
    switch (uptimeResult.check_status) {
      case 'success':
        return 'Success';
      case 'failure':
        return 'Failed';
      case 'missed_window':
        return 'Missed';
      default:
        return 'Unknown';
    }
  };

  return (
    <div
      key={props.index}
      ref={r =>
        props.tabIndex === 0
          ? maybeFocusTraceRow(r, props.node, props.previouslyFocusedNodeRef)
          : undefined
      }
      tabIndex={props.tabIndex}
      className={`TraceRow ${props.rowSearchClassName} ${uptimeResult.check_status === 'failure' ? 'error' : ''}`}
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
          </div>
          <PlatformIcon
            platform={props.projects[props.node.metadata.project_slug ?? ''] ?? 'default'}
          />
          <span className="TraceOperation">uptime.check</span>
          <strong className="TraceEmDash"> — </strong>
          <span className="TraceDescription" title={description}>
            {getStatusIcon()}
            <span style={{marginLeft: 4}}>{getStatusText()}</span>
            {uptimeResult.http_status_code && (
              <span style={{marginLeft: 8, color: 'var(--gray300)'}}>
                HTTP {uptimeResult.http_status_code}
              </span>
            )}
            <span style={{marginLeft: 8}}>
              {description.length > 80
                ? description.slice(0, 80).trim() + '\u2026'
                : description}
            </span>
            {uptimeResult.region && (
              <span style={{marginLeft: 8, color: 'var(--gray300)'}}>
                ({uptimeResult.region})
              </span>
            )}
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
          color={makeTraceNodeBarColor(
            props.theme,
            props.node,
            uptimeResult.check_status === 'failure' ? 'error' : 'performance'
          )}
        />
      </div>
    </div>
  );
}
