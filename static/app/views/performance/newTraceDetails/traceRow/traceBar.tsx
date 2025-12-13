import {Fragment, useCallback} from 'react';

import {formatTraceDuration} from 'sentry/utils/duration/formatTraceDuration';
import type {BaseNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/baseNode';
import type {VirtualizedViewManager} from 'sentry/views/performance/newTraceDetails/traceRenderers/virtualizedViewManager';
import {TraceBackgroundPatterns} from 'sentry/views/performance/newTraceDetails/traceRow/traceBackgroundPatterns';
import {
  TraceErrorIcons,
  TraceOccurenceIcons,
} from 'sentry/views/performance/newTraceDetails/traceRow/traceIcons';

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
  virtualized_index: number;
  durationPrecision?: number;
}

export function TraceBar(props: TraceBarProps) {
  let duration: string | null = null;

  if (props.node_space) {
    const precision = props.durationPrecision ?? 2;
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
        {props.occurrences.size > 0 || props.errors.size > 0 || props.node.hasProfiles ? (
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
