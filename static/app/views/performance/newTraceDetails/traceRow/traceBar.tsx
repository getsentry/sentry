import {Fragment, useCallback} from 'react';
import type {Theme} from '@emotion/react';

import {pickBarColor} from 'sentry/components/performance/waterfall/utils';
import {formatTraceDuration} from 'sentry/utils/duration/formatTraceDuration';
import {getStylingSliceName} from 'sentry/views/explore/tables/tracesTable/utils';
import {
  isAutogroupedNode,
  isEAPErrorNode,
  isEAPSpanNode,
  isMissingInstrumentationNode,
  isSpanNode,
  isTraceErrorNode,
  isTransactionNode,
} from 'sentry/views/performance/newTraceDetails/traceGuards';
import type {BaseNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/baseNode';
import type {VirtualizedViewManager} from 'sentry/views/performance/newTraceDetails/traceRenderers/virtualizedViewManager';
import {TraceBackgroundPatterns} from 'sentry/views/performance/newTraceDetails/traceRow/traceBackgroundPatterns';
import {
  TraceErrorIcons,
  TraceOccurenceIcons,
} from 'sentry/views/performance/newTraceDetails/traceRow/traceIcons';

export function makeTraceNodeBarColor(theme: Theme, node: BaseNode): string {
  if (isTransactionNode(node)) {
    return pickBarColor(
      getStylingSliceName(node.value.project_slug, node.value.sdk_name) ??
        node.value['transaction.op'],
      theme
    );
  }
  if (isSpanNode(node) || isEAPSpanNode(node)) {
    return pickBarColor(node.value.op, theme);
  }
  if (isAutogroupedNode(node)) {
    if (node.errors.size > 0) {
      return theme.red300;
    }
    return theme.blue300;
  }
  if (isMissingInstrumentationNode(node)) {
    return theme.gray300;
  }

  if (isTraceErrorNode(node) || isEAPErrorNode(node)) {
    // Theme defines this as orange, yet everywhere in our product we show red for errors
    if (node.value.level === 'error' || node.value.level === 'fatal') {
      return theme.red300;
    }
    if (node.value.level) {
      return theme.level[node.value.level] ?? theme.red300;
    }
    return theme.red300;
  }
  return pickBarColor('default', theme);
}

interface InvisibleTraceBarProps {
  children: React.ReactNode;
  manager: VirtualizedViewManager;
  node_space: [number, number] | null;
  virtualizedIndex: number;
}
export function InvisibleTraceBar(props: InvisibleTraceBarProps) {
  const registerInvisibleBarRef = useCallback(
    (ref: HTMLDivElement | null) => {
      props.manager.registerInvisibleBarRef(
        ref,
        props.node_space!,
        props.virtualizedIndex
      );
    },
    [props.manager, props.node_space, props.virtualizedIndex]
  );

  const onDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      props.manager.onZoomIntoSpace(props.node_space!);
    },
    [props.manager, props.node_space]
  );

  if (!props.node_space || !props.children) {
    return null;
  }

  return (
    <div
      ref={registerInvisibleBarRef}
      onDoubleClick={onDoubleClick}
      className="TraceBar Invisible"
    >
      {props.children}
    </div>
  );
}

interface MissingInstrumentationTraceBarProps {
  color: string;
  manager: VirtualizedViewManager;
  node_space: [number, number] | null;
  virtualized_index: number;
}

export function MissingInstrumentationTraceBar(
  props: MissingInstrumentationTraceBarProps
) {
  const duration = props.node_space ? formatTraceDuration(props.node_space[1]) : null;

  const registerSpanBarRef = useCallback(
    (ref: HTMLDivElement | null) => {
      props.manager.registerSpanBarRef(
        ref,
        props.node_space!,
        props.color,
        props.virtualized_index
      );
    },
    [props.manager, props.node_space, props.color, props.virtualized_index]
  );

  const registerSpanBarTextRef = useCallback(
    (ref: HTMLDivElement | null) => {
      props.manager.registerSpanBarTextRef(
        ref,
        duration!,
        props.node_space!,
        props.virtualized_index
      );
    },
    [props.manager, props.node_space, props.virtualized_index, duration]
  );

  return (
    <Fragment>
      <div ref={registerSpanBarRef} className="TraceBar">
        <div className="TracePatternContainer">
          <div className="TracePattern missing_instrumentation" />
        </div>
      </div>
      <div ref={registerSpanBarTextRef} className="TraceBarDuration">
        {duration}
      </div>
    </Fragment>
  );
}

interface TraceBarProps {
  color: string;
  errors: BaseNode['errors'];
  manager: VirtualizedViewManager;
  node: BaseNode;
  node_space: [number, number] | null;
  occurrences: BaseNode['occurrences'];
  profiles: BaseNode['profiles'];
  virtualized_index: number;
}

export function TraceBar(props: TraceBarProps) {
  let duration: string | null = null;

  if (props.node_space) {
    // Since transactions have ms precision, we show 2 decimal places only if the duration is greater than 1 second.
    const precision = isTransactionNode(props.node)
      ? props.node_space[1] >= 1000
        ? 2
        : 0
      : 2;
    duration = formatTraceDuration(props.node_space[1], precision);
  }

  const registerSpanBarRef = useCallback(
    (ref: HTMLDivElement | null) => {
      props.manager.registerSpanBarRef(
        ref,
        props.node_space!,
        props.color,
        props.virtualized_index
      );
    },
    [props.manager, props.node_space, props.color, props.virtualized_index]
  );

  const registerSpanBarTextRef = useCallback(
    (ref: HTMLDivElement | null) => {
      props.manager.registerSpanBarTextRef(
        ref,
        duration!,
        props.node_space!,
        props.virtualized_index
      );
    },
    [props.manager, props.node_space, props.virtualized_index, duration]
  );

  if (!props.node_space) {
    return null;
  }

  return (
    <Fragment>
      <div ref={registerSpanBarRef} className="TraceBar">
        {props.errors.size > 0 ? (
          <TraceErrorIcons
            node_space={props.node_space}
            errors={props.errors}
            manager={props.manager}
          />
        ) : null}
        {props.occurrences.size > 0 ? (
          <TraceOccurenceIcons
            node_space={props.node_space}
            occurrences={props.occurrences}
            manager={props.manager}
          />
        ) : null}
        {props.occurrences.size > 0 ||
        props.errors.size > 0 ||
        props.profiles.size > 0 ? (
          <TraceBackgroundPatterns
            node_space={props.node_space}
            occurrences={props.occurrences}
            errors={props.errors}
            manager={props.manager}
          />
        ) : null}
      </div>
      <div ref={registerSpanBarTextRef} className="TraceBarDuration">
        {duration}
      </div>
    </Fragment>
  );
}

interface AutogroupedTraceBarProps {
  color: string;
  entire_space: [number, number] | null;
  errors: BaseNode['errors'];
  manager: VirtualizedViewManager;
  node: BaseNode;
  node_spaces: Array<[number, number]>;
  occurrences: BaseNode['occurrences'];
  profiles: BaseNode['profiles'];
  virtualized_index: number;
}

export function AutogroupedTraceBar(props: AutogroupedTraceBarProps) {
  const duration = props.entire_space ? formatTraceDuration(props.entire_space[1]) : null;

  const registerInvisibleBarRef = useCallback(
    (ref: HTMLDivElement | null) => {
      props.manager.registerInvisibleBarRef(
        ref,
        props.entire_space!,
        props.virtualized_index
      );
    },
    [props.manager, props.entire_space, props.virtualized_index]
  );

  const registerAutogroupedSpanBarTextRef = useCallback(
    (ref: HTMLDivElement | null) => {
      props.manager.registerSpanBarTextRef(
        ref,
        duration!,
        props.entire_space!,
        props.virtualized_index
      );
    },
    [props.manager, props.entire_space, props.virtualized_index, duration]
  );

  if (props.node_spaces && props.node_spaces.length <= 1) {
    return (
      <TraceBar
        color={props.color}
        node={props.node}
        node_space={props.entire_space}
        manager={props.manager}
        virtualized_index={props.virtualized_index}
        errors={props.errors}
        occurrences={props.occurrences}
        profiles={props.profiles}
      />
    );
  }

  if (!props.node_spaces || !props.entire_space) {
    return null;
  }

  return (
    <Fragment>
      <div ref={registerInvisibleBarRef} className="TraceBar Invisible">
        {props.node_spaces.map((node_space, i) => {
          const width = node_space[1] / props.entire_space![1];
          const left = props.manager.computeRelativeLeftPositionFromOrigin(
            node_space[0],
            props.entire_space!
          );
          return (
            <div
              key={i}
              className="TraceBar"
              style={{
                left: `${left * 100}%`,
                width: `${width * 100}%`,
                backgroundColor: props.color,
              }}
            />
          );
        })}
        {/* Autogrouped bars only render icons. That is because in the case of multiple bars
            with tiny gaps, the background pattern looks broken as it does not repeat nicely */}
        {props.errors.size > 0 ? (
          <TraceErrorIcons
            node_space={props.entire_space}
            errors={props.errors}
            manager={props.manager}
          />
        ) : null}
        {props.occurrences.size > 0 ? (
          <TraceOccurenceIcons
            node_space={props.entire_space}
            occurrences={props.occurrences}
            manager={props.manager}
          />
        ) : null}
      </div>
      <div ref={registerAutogroupedSpanBarTextRef} className="TraceBarDuration">
        {duration}
      </div>
    </Fragment>
  );
}
