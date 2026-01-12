import type React from 'react';
import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {useTheme, type Theme} from '@emotion/react';
import styled from '@emotion/styled';

import {Tooltip} from 'sentry/components/core/tooltip';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import type {PlatformKey, Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {formatTraceDuration} from 'sentry/utils/duration/formatTraceDuration';
import {VITAL_DETAILS} from 'sentry/utils/performance/vitals/constants';
import {replayPlayerTimestampEmitter} from 'sentry/utils/replays/replayPlayerTimestampEmitter';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {
  getFormattedDuration,
  WEB_VITALS_METERS_CONFIG,
} from 'sentry/views/insights/browser/webVitals/components/webVitalMeters';
import type {WebVitals} from 'sentry/views/insights/browser/webVitals/types';
import {
  scoreToStatus,
  STATUS_TEXT,
} from 'sentry/views/insights/browser/webVitals/utils/scoreToStatus';

import {TraceTree} from './traceModels/traceTree';
import type {BaseNode} from './traceModels/traceTreeNode/baseNode';
import type {TraceEvents, TraceScheduler} from './traceRenderers/traceScheduler';
import {
  useVirtualizedList,
  type VirtualizedRow,
} from './traceRenderers/traceVirtualizedList';
import type {VirtualizedViewManager} from './traceRenderers/virtualizedViewManager';
import {TraceLoadingRow} from './traceRow/traceLoadingRow';
import {
  TRACE_CHILDREN_COUNT_WRAPPER_CLASSNAME,
  TRACE_CHILDREN_COUNT_WRAPPER_ORPHANED_CLASSNAME,
  TRACE_RIGHT_COLUMN_EVEN_CLASSNAME,
  TRACE_RIGHT_COLUMN_ODD_CLASSNAME,
  type TraceRowProps,
} from './traceRow/traceRow';
import {
  getRovingIndexActionFromDOMEvent,
  type RovingTabIndexUserActions,
} from './traceState/traceRovingTabIndex';
import {useTraceState, useTraceStateDispatch} from './traceState/traceStateProvider';
import type {TraceReducerState} from './traceState';

function computeNextIndexFromAction(
  current_index: number,
  action: RovingTabIndexUserActions,
  items: number
): number {
  switch (action) {
    case 'next':
      if (current_index === items) {
        return 0;
      }
      return current_index + 1;
    case 'previous':
      if (current_index === 0) {
        return items;
      }
      return current_index - 1;
    case 'last':
      return items;
    case 'first':
      return 0;
    default:
      throw new TypeError(`Invalid or not implemented reducer action - ${action}`);
  }
}

interface TraceProps {
  forceRerender: number;
  isLoading: boolean;
  manager: VirtualizedViewManager;
  onRowClick: (
    node: BaseNode,
    event: React.MouseEvent<HTMLElement>,
    index: number
  ) => void;
  onTraceSearch: (
    query: string,
    node: BaseNode,
    behavior: 'track result' | 'persist'
  ) => void;
  previouslyFocusedNodeRef: React.MutableRefObject<BaseNode | null>;
  rerender: () => void;
  scheduler: TraceScheduler;
  trace: TraceTree;
  trace_id: string | undefined;
}

export function Trace({
  trace,
  onRowClick,
  manager,
  previouslyFocusedNodeRef,
  onTraceSearch,
  rerender,
  scheduler,
  forceRerender,
  trace_id,
  isLoading,
}: TraceProps) {
  const theme = useTheme();
  const api = useApi();
  const {projects} = useProjects();
  const organization = useOrganization();
  const traceState = useTraceState();
  const traceDispatch = useTraceStateDispatch();
  const {theme: colorMode} = useLegacyStore(ConfigStore);

  const rerenderRef = useRef<TraceProps['rerender']>(rerender);
  rerenderRef.current = rerender;

  const treePromiseStatusRef = useRef<Map<
    BaseNode,
    'loading' | 'error' | 'success'
  > | null>(null);

  if (!treePromiseStatusRef.current) {
    treePromiseStatusRef.current = new Map();
  }

  const treeRef = useRef<TraceTree>(trace);
  treeRef.current = trace;

  const traceStateRef = useRef<TraceReducerState>(traceState);
  traceStateRef.current = traceState;

  const traceStatePreferencesRef = useRef<
    Pick<TraceReducerState['preferences'], 'autogroup' | 'missing_instrumentation'>
  >(traceState.preferences);
  traceStatePreferencesRef.current = traceState.preferences;

  useLayoutEffect(() => {
    const onTraceViewChange: TraceEvents['set trace view'] = () => {
      manager.recomputeTimelineIntervals();
      manager.recomputeSpanToPXMatrix();
      manager.syncResetZoomButton();
      manager.draw();
    };
    const onPhysicalSpaceChange: TraceEvents['set container physical space'] = () => {
      manager.recomputeTimelineIntervals();
      manager.recomputeSpanToPXMatrix();
      manager.draw();
    };
    const onTraceSpaceChange: TraceEvents['initialize trace space'] = () => {
      manager.recomputeTimelineIntervals();
      manager.recomputeSpanToPXMatrix();
      manager.draw();
    };
    const onDividerResize: TraceEvents['divider resize'] = view => {
      manager.recomputeTimelineIntervals();
      manager.recomputeSpanToPXMatrix();
      manager.draw(view);
    };

    scheduler.on('set trace view', onTraceViewChange);
    scheduler.on('set trace space', onTraceSpaceChange);
    scheduler.on('set container physical space', onPhysicalSpaceChange);
    scheduler.on('initialize trace space', onTraceSpaceChange);
    scheduler.on('divider resize', onDividerResize);

    return () => {
      scheduler.off('set trace view', onTraceViewChange);
      scheduler.off('set trace space', onTraceSpaceChange);
      scheduler.off('set container physical space', onPhysicalSpaceChange);
      scheduler.off('initialize trace space', onTraceSpaceChange);
      scheduler.off('divider resize', onDividerResize);
    };
  }, [manager, scheduler]);

  const onNodeZoomIn = useCallback(
    (
      event: React.MouseEvent<Element> | React.KeyboardEvent<Element>,
      node: BaseNode,
      value: boolean
    ) => {
      event.stopPropagation();
      rerenderRef.current();

      treeRef.current
        .fetchNodeSubTree(value, node, {
          api,
          organization,
          preferences: traceStatePreferencesRef.current,
        })
        .then(() => {
          rerenderRef.current();

          // If a query exists, we want to reapply the search after zooming in
          // so that new nodes are also highlighted if they match a query
          if (traceStateRef.current.search.query) {
            onTraceSearch(traceStateRef.current.search.query, node, 'persist');
          }

          treePromiseStatusRef.current!.set(node, 'success');
        })
        .catch(_e => {
          treePromiseStatusRef.current!.set(node, 'error');
        });
    },
    [api, organization, onTraceSearch]
  );

  const onNodeExpand = useCallback(
    (
      event: React.MouseEvent<Element> | React.KeyboardEvent<Element>,
      node: BaseNode,
      value: boolean
    ) => {
      event.stopPropagation();

      node.expand(value, treeRef.current);
      rerenderRef.current();
    },
    []
  );

  const onRowKeyDown = useCallback(
    (event: React.KeyboardEvent, index: number, node: BaseNode) => {
      if (!manager.list) {
        return;
      }
      const action = getRovingIndexActionFromDOMEvent(event);
      if (action) {
        event.preventDefault();
        const nextIndex = computeNextIndexFromAction(
          index,
          action,
          treeRef.current.list.length - 1
        );

        traceDispatch({
          type: 'set roving index',
          index: nextIndex,
          node: treeRef.current.list[nextIndex]!,
          action_source: 'keyboard',
        });
      }

      if (event.key === 'ArrowLeft') {
        if (node.hasFetchedChildren) {
          onNodeZoomIn(event, node, false);
        } else if (node.expanded) {
          onNodeExpand(event, node, false);
        }
      } else if (event.key === 'ArrowRight') {
        if (node.canFetchChildren) {
          onNodeZoomIn(event, node, true);
        } else {
          onNodeExpand(event, node, true);
        }
      }
    },
    [manager, onNodeExpand, onNodeZoomIn, traceDispatch]
  );

  const projectLookup: Record<string, PlatformKey | undefined> = useMemo(() => {
    return projects.reduce<Record<Project['slug'], Project['platform']>>(
      (acc, project) => {
        acc[project.slug] = project.platform;
        return acc;
      },
      {}
    );
  }, [projects]);

  const renderLoadingRow = useCallback(
    (n: VirtualizedRow) => {
      return (
        <TraceLoadingRow
          key={n.key}
          index={n.index}
          style={n.style}
          node={n.item}
          theme={theme}
          manager={manager}
        />
      );
    },
    [manager, theme]
  );

  const renderVirtualizedRow = useCallback(
    (n: VirtualizedRow) => {
      return (
        <RenderTraceRow
          key={n.key}
          index={n.index}
          organization={organization}
          previouslyFocusedNodeRef={previouslyFocusedNodeRef}
          tabIndex={traceState.rovingTabIndex.node === n.item ? 0 : -1}
          isSearchResult={traceState.search.resultsLookup.has(n.item)}
          searchResultsIteratorIndex={traceState.search.resultIndex}
          style={n.style}
          projects={projectLookup}
          node={n.item}
          manager={manager}
          theme={theme}
          onExpand={onNodeExpand}
          onZoomIn={onNodeZoomIn}
          onRowClick={onRowClick}
          onRowKeyDown={onRowKeyDown}
          tree={trace}
          trace_id={trace_id}
        />
      );
    },
    // we add forceRerender as a "unnecessary" dependency to trigger the virtualized list rerender
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      onNodeExpand,
      onNodeZoomIn,
      manager,
      previouslyFocusedNodeRef,
      onRowKeyDown,
      onRowClick,
      organization,
      projectLookup,
      traceState.rovingTabIndex.node,
      traceState.search.resultIteratorIndex,
      traceState.search.resultsLookup,
      traceState.search.resultIndex,
      theme,
      trace.type,
      forceRerender,
    ]
  );

  const render = useMemo(() => {
    return trace.type !== 'trace' || isLoading
      ? (r: any) => renderLoadingRow(r)
      : (r: any) => renderVirtualizedRow(r);
  }, [isLoading, renderLoadingRow, renderVirtualizedRow, trace.type]);

  const traceNode = trace.root.children[0];
  const traceStartTimestamp = traceNode?.space?.[0];

  const [scrollContainer, setScrollContainer] = useState<HTMLElement | null>(null);
  const virtualizedList = useVirtualizedList({
    manager,
    items: trace.list,
    container: scrollContainer,
    render,
    scheduler,
  });

  return (
    <TraceStylingWrapper
      ref={manager.registerContainerRef}
      className={`
        ${trace.root.space[1] === 0 ? 'Empty' : ''}
        ${trace.indicators.length > 0 ? 'WithIndicators' : ''}
        ${trace.type !== 'trace' || isLoading ? 'Loading' : ''}
        ${ConfigStore.get('theme')}`}
    >
      <div
        className="TraceScrollbarContainer"
        ref={manager.registerHorizontalScrollBarContainerRef}
      >
        <div className="TraceScrollbarScroller" />
      </div>
      <div className="TraceDivider" ref={manager.registerDividerRef} />
      <div
        className="TraceIndicatorsContainer"
        ref={manager.registerIndicatorContainerRef}
      >
        <div className="TraceIndicatorContainerMiddleLine" />
        {trace.indicators.length > 0
          ? trace.indicators.map((indicator, i) => {
              const status =
                indicator.score === undefined
                  ? 'None'
                  : STATUS_TEXT[scoreToStatus(indicator.score)];
              const vital = indicator.type as WebVitals;

              const defaultFormatter = (value: number) =>
                getFormattedDuration(value / 1000);
              const formatter =
                WEB_VITALS_METERS_CONFIG[vital]?.formatter ?? defaultFormatter;

              return (
                <Fragment key={i}>
                  <div
                    key={i}
                    ref={r => manager.registerIndicatorLabelRef(r, i, indicator)}
                    className={`TraceIndicatorLabelContainer ${status} ${colorMode}`}
                  >
                    <Tooltip
                      title={
                        <div>
                          {VITAL_DETAILS[`measurements.${vital}`]?.name}
                          <br />
                          {formatter(indicator.measurement.value)}
                          {status !== 'None' && ` - ${status}`}
                        </div>
                      }
                    >
                      <div className="TraceIndicatorLabel">{indicator.label}</div>
                    </Tooltip>
                  </div>
                  <div
                    ref={r => manager.registerIndicatorRef(r, i, indicator)}
                    className={`TraceIndicator ${indicator.poor ? 'Errored' : ''}`}
                  >
                    <div className={`TraceIndicatorLine ${status}`} />
                  </div>
                </Fragment>
              );
            })
          : null}

        {manager.interval_bars.map((_, i) => {
          const indicatorTimestamp = manager.intervals[i] ?? 0;

          if (trace.type !== 'trace' || isLoading) {
            return null;
          }

          return (
            <div
              key={i}
              ref={r => manager.registerTimelineIndicatorRef(r, i)}
              className="TraceIndicator Timeline"
            >
              <div className="TraceIndicatorLabelContainer">
                {indicatorTimestamp > 0
                  ? formatTraceDuration(manager.view.trace_view.x + indicatorTimestamp)
                  : '0s'}
              </div>
              <div className="TraceIndicatorLine" />
            </div>
          );
        })}
        {traceNode && traceStartTimestamp ? (
          <VerticalTimestampIndicators
            viewmanager={manager}
            traceStartTimestamp={traceStartTimestamp}
          />
        ) : null}
      </div>
      <div
        ref={setScrollContainer}
        data-test-id="trace-virtualized-list-scroll-container"
        id="trace-waterfall"
      >
        <div data-test-id="trace-virtualized-list">{virtualizedList.rendered}</div>
        <div className="TraceRow Hidden">
          <div
            className="TraceLeftColumn"
            ref={r => manager.registerGhostRowRef('list', r)}
          />
          <div
            className="TraceRightColumn"
            ref={r => manager.registerGhostRowRef('span_list', r)}
          />
        </div>
      </div>
    </TraceStylingWrapper>
  );
}

function RenderTraceRow(props: {
  index: number;
  isSearchResult: boolean;
  manager: VirtualizedViewManager;
  node: BaseNode;
  onExpand: (event: React.MouseEvent<Element>, node: BaseNode, value: boolean) => void;
  onRowClick: (
    node: BaseNode,
    event: React.MouseEvent<HTMLElement>,
    index: number
  ) => void;
  onRowKeyDown: (event: React.KeyboardEvent, index: number, node: BaseNode) => void;
  onZoomIn: (event: React.MouseEvent<Element>, node: BaseNode, value: boolean) => void;
  organization: Organization;
  previouslyFocusedNodeRef: React.MutableRefObject<BaseNode | null>;
  projects: Record<Project['slug'], Project['platform']>;
  searchResultsIteratorIndex: number | null;
  style: React.CSSProperties;
  tabIndex: number;
  theme: Theme;
  trace_id: string | undefined;
  tree: TraceTree;
}) {
  const node = props.node;
  const virtualized_index = props.index - props.manager.start_virtualized_index;
  const rowSearchClassName = `${props.isSearchResult ? 'SearchResult' : ''} ${props.searchResultsIteratorIndex === props.index ? 'Highlight' : ''}`;

  const registerListColumnRef = useCallback(
    (ref: HTMLDivElement | null) => {
      props.manager.registerColumnRef('list', ref, virtualized_index, node);
    },
    [props.manager, node, virtualized_index]
  );

  const registerSpanColumnRef = useCallback(
    (ref: HTMLDivElement | null) => {
      props.manager.registerColumnRef('span_list', ref, virtualized_index, node);
    },
    [props.manager, node, virtualized_index]
  );

  const registerSpanArrowRef = useCallback(
    (ref: any) => {
      props.manager.registerArrowRef(ref, node.space, virtualized_index);
    },
    [props.manager, node, virtualized_index]
  );

  const onRowClickProp = props.onRowClick;
  const onRowClick = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      onRowClickProp(node, event, props.index);
    },
    [props.index, node, onRowClickProp]
  );

  const onRowKeyDownProp = props.onRowKeyDown;
  const onRowKeyDown = useCallback(
    (event: React.KeyboardEvent) => onRowKeyDownProp(event, props.index, node),
    [props.index, node, onRowKeyDownProp]
  );

  const onRowDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      trackAnalytics('trace.trace_layout.zoom_to_fill', {
        organization: props.organization,
      });
      e.stopPropagation();
      props.manager.onZoomIntoSpace(node.space);
    },
    [node, props.manager, props.organization]
  );

  const onSpanRowArrowClick = useCallback(
    (_e: React.MouseEvent) => {
      props.manager.onBringRowIntoView(node.space);
    },
    [node.space, props.manager]
  );

  const onExpandProp = props.onExpand;
  const onExpand = useCallback(
    (e: React.MouseEvent) => {
      onExpandProp(e, node, !node.expanded);
    },
    [node, onExpandProp]
  );

  const onZoomInProp = props.onZoomIn;
  const onZoomIn = useCallback(
    (e: React.MouseEvent) => {
      onZoomInProp(e, node, !node.hasFetchedChildren);
    },
    [node, onZoomInProp]
  );
  const onExpandDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const spanColumnClassName =
    props.index % 2 === 1
      ? TRACE_RIGHT_COLUMN_ODD_CLASSNAME
      : TRACE_RIGHT_COLUMN_EVEN_CLASSNAME;

  const listColumnClassName = node.isRootNodeChild()
    ? TRACE_CHILDREN_COUNT_WRAPPER_ORPHANED_CLASSNAME
    : TRACE_CHILDREN_COUNT_WRAPPER_CLASSNAME;

  const listColumnStyle: React.CSSProperties = {
    paddingLeft: TraceTree.Depth(node) * props.manager.row_depth_padding,
  };

  const rowProps: TraceRowProps<BaseNode> = {
    onExpand,
    onZoomIn,
    onRowClick,
    onRowKeyDown,
    previouslyFocusedNodeRef: props.previouslyFocusedNodeRef,
    onSpanArrowClick: onSpanRowArrowClick,
    manager: props.manager,
    index: props.index,
    theme: props.theme,
    style: props.style,
    projects: props.projects,
    tabIndex: props.tabIndex,
    onRowDoubleClick,
    trace_id: props.trace_id,
    node: props.node,
    virtualized_index,
    listColumnStyle,
    listColumnClassName,
    spanColumnClassName,
    onExpandDoubleClick,
    rowSearchClassName,
    registerListColumnRef,
    registerSpanColumnRef,
    registerSpanArrowRef,
  };

  return node.renderWaterfallRow(rowProps);
}

function VerticalTimestampIndicators({
  viewmanager,
  traceStartTimestamp,
}: {
  traceStartTimestamp: number;
  viewmanager: VirtualizedViewManager;
}) {
  useEffect(() => {
    function replayTimestampListener({
      currentTime,
      currentHoverTime,
    }: {
      currentHoverTime: number | undefined;
      currentTime: number;
    }) {
      if (viewmanager.vertical_indicators['replay_timestamp.current']) {
        viewmanager.vertical_indicators['replay_timestamp.current'].timestamp =
          traceStartTimestamp + currentTime;
      }

      if (viewmanager.vertical_indicators['replay_timestamp.hover']) {
        viewmanager.vertical_indicators['replay_timestamp.hover'].timestamp =
          currentHoverTime ? traceStartTimestamp + currentHoverTime : undefined;
      }

      // When timestamp is changing, it needs to be redrawn
      // if it is out of bounds, we need to scroll to it
      viewmanager.drawVerticalIndicators();
      viewmanager.maybeSyncViewWithVerticalIndicator('replay_timestamp.current');
    }

    replayPlayerTimestampEmitter.on('replay timestamp change', replayTimestampListener);

    return () => {
      replayPlayerTimestampEmitter.off(
        'replay timestamp change',
        replayTimestampListener
      );
    };
  }, [traceStartTimestamp, viewmanager]);

  const registerReplayCurrentTimestampRef = useCallback(
    (ref: HTMLDivElement | null) => {
      viewmanager.registerVerticalIndicator('replay_timestamp.current', {
        ref,
        timestamp: undefined,
      });
    },
    [viewmanager]
  );

  const registerReplayHoverTimestampRef = useCallback(
    (ref: HTMLDivElement | null) => {
      viewmanager.registerVerticalIndicator('replay_timestamp.hover', {
        ref,
        timestamp: undefined,
      });
    },
    [viewmanager]
  );

  return (
    <Fragment>
      <div ref={registerReplayCurrentTimestampRef} className="TraceIndicator Timeline">
        <div className="Indicator CurrentReplayTimestamp" />
      </div>
      <div ref={registerReplayHoverTimestampRef} className="TraceIndicator Timeline">
        <div className="Indicator HoverReplayTimestamp" />
      </div>
    </Fragment>
  );
}

/**
 * This is a wrapper around the Trace component to apply styles
 * to the trace tree. It exists because we _do not_ want to trigger
 * emotion's css parsing logic as it is very slow and will cause
 * the scrolling to flicker.
 */
const TraceStylingWrapper = styled('div')`
  margin: auto;
  overscroll-behavior: none;
  box-shadow: 0 0 0 1px ${p => p.theme.tokens.border.primary};
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  grid-area: trace;
  padding-top: 38px;

  &.WithIndicators {
    &:before {
      background-color: ${p => p.theme.tokens.background.primary};
      height: 38px;

      .TraceScrollbarContainer {
        height: 44px;
      }
    }

    .TraceIndicator.Timeline {
      .TraceIndicatorLabelContainer {
        top: 22px;
      }
      .TraceIndicatorLine {
        top: 30px;
      }

      .Indicator {
        top: 44px;
      }
    }
  }

  &:before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 38px;
    background-color: ${p => p.theme.tokens.background.primary};
    border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
    z-index: 10;
  }

  &.Loading {
    .TraceRow {
      .TraceLeftColumnInner {
        width: 100%;
      }
    }

    .TraceRightColumn {
      background-color: transparent !important;
    }

    .TraceDivider {
      pointer-events: none;
    }
  }

  &.Empty {
    .TraceIcon {
      left: 50%;
    }
  }

  .TraceScrollbarContainer {
    left: 0;
    top: 0;
    height: 38px;
    position: absolute;
    overflow-x: auto;
    overscroll-behavior: none;
    will-change: transform;
    z-index: 10;
    display: flex;
    align-items: center;

    .TraceScrollbarScroller {
      height: 1px;
      pointer-events: none;
      visibility: hidden;
    }

    .TraceScrollbarHandle {
      width: 24px;
      height: 12px;
      border-radius: 6px;
    }
  }

  .TraceDivider {
    position: absolute;
    height: 100%;
    background-color: transparent;
    top: 0;
    cursor: ew-resize;
    z-index: 10;

    &:before {
      content: '';
      position: absolute;
      width: 1px;
      height: 100%;
      background-color: ${p => p.theme.tokens.border.primary};
      left: 50%;
    }

    &:hover {
      &:before {
        background-color: ${p => p.theme.colors.blue400};
      }
    }
  }

  .TraceIndicatorsContainer {
    overflow: hidden;
    width: 100%;
    height: 100%;
    position: absolute;
    right: 0;
    top: 0;
    z-index: 10;
    pointer-events: none;
  }

  .TraceIndicatorContainerMiddleLine {
    position: absolute;
    top: 18px;
    background-color: ${p => p.theme.tokens.border.primary};
    width: 100%;
    height: 1px;
  }

  .TraceIndicatorLabelContainer {
    min-width: 34px;
    text-align: center;
    position: absolute;
    font-size: 10px;
    font-weight: ${p => p.theme.fontWeight.bold};
    background-color: ${p => p.theme.tokens.background.primary};
    color: ${p => p.theme.tokens.content.primary};
    border-radius: 100px;
    border: 1px solid ${p => p.theme.tokens.border.primary};
    display: inline-block;
    line-height: 1;
    margin-top: 2px;
    white-space: nowrap;
    pointer-events: auto;
    cursor: pointer;

    &:hover {
      z-index: 10;
      & + div {
        z-index: 10;
      }
    }

    &.Poor {
      color: ${p => p.theme.colors.red400};
      border: 1px solid ${p => p.theme.colors.red400};

      &.light {
        background-color: rgb(251 232 233);
      }

      &.dark {
        background-color: rgb(63 17 20);
      }
    }

    &.None {
      color: ${p => p.theme.tokens.content.secondary};
      border: 1px solid ${p => p.theme.tokens.border.primary};

      &.light {
        background-color: rgb(245 245 245);
      }

      &.dark {
        background-color: rgb(60 59 59);
      }
    }

    &.Meh {
      color: ${p => p.theme.colors.yellow500};
      border: 1px solid ${p => p.theme.colors.yellow400};

      &.light {
        background-color: rgb(249 244 224);
      }

      &.dark {
        background-color: rgb(45 41 17);
      }
    }

    &.Good {
      color: ${p => p.theme.colors.green400};
      border: 1px solid ${p => p.theme.colors.green400};

      &.light {
        background-color: rgb(232 241 239);
      }

      &.dark {
        background-color: rgb(9 37 30);
      }
    }
  }

  .TraceIndicatorLabel {
    padding: 2px;
    border-radius: 100px;
  }

  .TraceIndicator {
    width: 3px;
    height: 100%;
    top: 0;
    position: absolute;

    .TraceIndicatorLine {
      width: 1px;
      height: 100%;
      top: 20px;
      position: absolute;
      left: 50%;
      transform: translate(-2px, -7px);
      background: repeating-linear-gradient(
          to bottom,
          transparent 0 4px,
          ${p => p.theme.tokens.content.primary} 4px 8px
        )
        80%/2px 100% no-repeat;

      &.Poor {
        background: repeating-linear-gradient(
            to bottom,
            transparent 0 4px,
            ${p => p.theme.colors.red400} 4px 8px
          )
          80%/2px 100% no-repeat;
      }

      &.None {
        background: repeating-linear-gradient(
            to bottom,
            transparent 0 4px,
            ${p => p.theme.tokens.content.secondary} 4px 8px
          )
          80%/2px 100% no-repeat;
      }

      &.Meh {
        background: repeating-linear-gradient(
            to bottom,
            transparent 0 4px,
            ${p => p.theme.colors.yellow400} 4px 8px
          )
          80%/2px 100% no-repeat;
      }

      &.Good {
        background: repeating-linear-gradient(
            to bottom,
            transparent 0 4px,
            ${p => p.theme.colors.green400} 4px 8px
          )
          80%/2px 100% no-repeat;
      }
    }

    .Indicator {
      width: 1px;
      height: 100%;
      position: absolute;
      left: 50%;
      transform: translateX(-2px);
      top: 26px;

      &.CurrentReplayTimestamp {
        background: ${p => p.theme.colors.blue400};
      }

      &.HoverReplayTimestamp {
        background: ${p => p.theme.colors.blue200};
      }
    }

    &.Errored {
      .TraceIndicatorLabelContainer {
        border: 1px solid ${p => p.theme.error};
        color: ${p => p.theme.error};
      }

      .TraceIndicatorLine {
        background: repeating-linear-gradient(
            to bottom,
            transparent 0 4px,
            ${p => p.theme.error} 4px 8px
          )
          80%/2px 100% no-repeat;
      }
    }

    &.Timeline {
      opacity: 1;
      z-index: 1;
      pointer-events: none;

      .TraceIndicatorLabelContainer {
        font-weight: ${p => p.theme.fontWeight.normal};
        min-width: 0;
        top: 22px;
        width: auto;
        border: none;
        background-color: transparent;
        color: ${p => p.theme.tokens.content.secondary};
      }

      .TraceIndicatorLine {
        background: ${p => p.theme.colors.gray100};
        top: 8px;
      }
    }
  }

  &.light {
    .TracePattern {
      &.info {
        --pattern-odd: ${p => p.theme.colors.blue500};
        --pattern-even: ${p => p.theme.colors.blue400};
      }
      &.warning {
        --pattern-odd: ${p => p.theme.colors.yellow500};
        --pattern-even: ${p => p.theme.colors.yellow400};
      }
      &.occurence {
        --pattern-odd: ${p => p.theme.colors.blue500};
        --pattern-even: ${p => p.theme.colors.blue400};
      }

      &.profile {
        --pattern-odd: rgba(58, 17, 95, 0.55);
        --pattern-even: transparent;
      }

      /* hardcoded until new color scales are added to theme */
      &.missing_instrumentation {
        --pattern-odd: ${p => p.theme.backgroundTertiary};
        --pattern-even: ${p => p.theme.tokens.background.primary};
      }

      &.error,
      &.fatal {
        --pattern-odd: ${p => p.theme.colors.red500};
        --pattern-even: ${p => p.theme.colors.red400};
      }

      /* false positive for grid layout */
      /* stylelint-disable */
      &.default {
      }
      &.unknown {
      }
      /* stylelint-enable */
    }
  }

  &.dark {
    .TracePattern {
      &.info {
        --pattern-odd: ${p => p.theme.colors.blue500};
        --pattern-even: ${p => p.theme.colors.blue400};
      }
      &.warning {
        --pattern-odd: ${p => p.theme.colors.yellow500};
        --pattern-even: ${p => p.theme.colors.yellow400};
      }
      &.occurence {
        --pattern-odd: ${p => p.theme.colors.blue500};
        --pattern-even: ${p => p.theme.colors.blue400};
      }

      &.profile {
        --pattern-odd: rgba(58, 17, 95, 0.55);
        --pattern-even: transparent;
      }

      /* hardcoded until new color scales are added to theme */
      &.missing_instrumentation {
        --pattern-odd: ${p => p.theme.colors.surface200};
        --pattern-even: ${p => p.theme.colors.surface400};
      }

      &.error,
      &.fatal {
        --pattern-odd: ${p => p.theme.colors.red500};
        --pattern-even: ${p => p.theme.colors.red400};
      }
      /* stylelint-disable */
      &.default {
      }
      &.unknown {
      }
      /* stylelint-enable */
    }
  }

  .TraceRow {
    display: flex;
    align-items: center;
    position: absolute;
    height: 24px;
    width: 100%;
    transition: none;
    font-size: ${p => p.theme.fontSize.sm};
    transform: translateZ(0);

    --row-background-odd: ${p => p.theme.backgroundSecondary};
    --row-background-hover: ${p => p.theme.backgroundTertiary};
    --row-background-focused: ${p => p.theme.backgroundTertiary};
    --row-outline: ${p => p.theme.colors.blue400};
    --row-children-button-border-color: ${p => p.theme.tokens.border.primary};

    /* allow empty blocks so we can keep an exhaustive list of classnames for future reference */
    /* stylelint-disable */
    &.info {
    }
    &.warning {
    }
    &.debug {
    }
    &.error,
    &.fatal,
    &.occurence {
      color: ${p => p.theme.errorText};
      --autogrouped: ${p => p.theme.error};
      --row-children-button-border-color: ${p => p.theme.error};
      --row-outline: ${p => p.theme.error};
    }
    &.default {
    }
    &.unknown {
    }

    &.Hidden {
      position: absolute;
      height: 100%;
      width: 100%;
      top: 0;
      z-index: -1;
      &:hover {
        background-color: transparent;
      }
      * {
        cursor: default !important;
      }
    }

    .TraceIcon {
      position: absolute;
      top: 50%;
      transform: translate(-50%, -50%) scaleX(var(--inverse-span-scale)) translateZ(0);
      background-color: ${p => p.theme.tokens.background.primary};
      width: 18px !important;
      height: 18px !important;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1;

      &.info {
        background-color: var(--info);
      }
      &.warning {
        background-color: var(--warning);
      }
      &.debug {
        background-color: var(--debug);
      }
      &.error,
      &.fatal {
        background-color: var(--error);
      }
      &.occurence {
        background-color: var(--occurence);
      }
      &.default {
        background-color: var(--default);
      }
      &.unknown {
        background-color: var(--unknown);
      }
      &.profile {
        background-color: var(--profile);
      }

      svg {
        width: 12px;
        height: 12px;
        fill: ${p => p.theme.white};
      }

      &.profile svg {
        margin-left: 2px;
      }

      &.info,
      &.warning,
      &.occurence,
      &.default,
      &.unknown {
        svg {
          transform: translateY(-1px);
        }
      }
    }

    .TracePatternContainer {
      position: absolute;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }

    .TracePattern {
      left: 0;
      width: 1000000px;
      height: 100%;
      position: absolute;
      transform-origin: left center;
      transform: scaleX(var(--inverse-span-scale)) translateZ(0);
      background-image: linear-gradient(
        135deg,
        var(--pattern-even) 1%,
        var(--pattern-even) 11%,
        var(--pattern-odd) 11%,
        var(--pattern-odd) 21%,
        var(--pattern-even) 21%,
        var(--pattern-even) 31%,
        var(--pattern-odd) 31%,
        var(--pattern-odd) 41%,
        var(--pattern-even) 41%,
        var(--pattern-even) 51%,
        var(--pattern-odd) 51%,
        var(--pattern-odd) 61%,
        var(--pattern-even) 61%,
        var(--pattern-even) 71%,
        var(--pattern-odd) 71%,
        var(--pattern-odd) 81%,
        var(--pattern-even) 81%,
        var(--pattern-even) 91%,
        var(--pattern-odd) 91%,
        var(--pattern-odd) 101%
      );
      background-size: 25.5px 17px;
    }

    .TraceRightColumn.Odd {
      background-color: var(--row-background-odd);
    }

    &:hover {
      background-color: var(--row-background-hovered);
    }

    &.Highlight {
      box-shadow: inset 0 0 0 1px ${p => p.theme.colors.blue400} !important;

      .TraceLeftColumn {
        box-shadow: inset 0px 0 0px 1px ${p => p.theme.colors.blue400} !important;
      }
    }

    &.Highlight,
    &:focus,
    &[tabindex='0'] {
      outline: none;
      background-color: var(--row-background-focused);

      .TraceRightColumn.Odd {
        background-color: transparent !important;
      }
    }

    &:focus,
    &[tabindex='0'] {
      background-color: var(--row-background-focused);
      box-shadow: inset 0 0 0 1px var(--row-outline) !important;

      .TraceLeftColumn {
        box-shadow: inset 0px 0 0px 1px var(--row-outline) !important;
      }
      .TraceRightColumn.Odd {
        background-color: transparent !important;
      }
    }

    &.SearchResult {
      background-color: ${p => p.theme.colors.yellow100};

      .TraceRightColumn {
        background-color: transparent;
      }
    }

    &.Autogrouped {
      color: ${p => p.theme.colors.blue400};

      .TraceDescription {
        font-weight: ${p => p.theme.fontWeight.bold};
      }

      .TraceChildrenCountWrapper {
        button {
          color: ${p => p.theme.white};
          background-color: ${p => p.theme.colors.blue400};
        }
        svg {
          fill: ${p => p.theme.white};
        }
      }

      &.error {
        color: ${p => p.theme.colors.red400};

        .TraceChildrenCountWrapper {
          button {
            color: ${p => p.theme.white};
            background-color: ${p => p.theme.colors.red400};
          }
        }
      }
    }

    &.Collapsed {
      background-color: ${p => p.theme.backgroundSecondary};
      border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
      border-top: 1px solid ${p => p.theme.tokens.border.primary};

      .TraceLeftColumn {
        padding-left: 14px;
        width: 100%;
        color: ${p => p.theme.tokens.content.secondary};

        .TraceLeftColumnInner {
          padding-left: 0 !important;
        }
      }
    }
  }

  .TraceLeftColumn {
    height: 100%;
    white-space: nowrap;
    display: flex;
    align-items: center;
    overflow: hidden;
    will-change: width;
    box-shadow: inset 1px 0 0px 0px transparent;
    cursor: pointer;

    width: calc(var(--list-column-width) * 100%);

    .TraceLeftColumnInner {
      height: 100%;
      white-space: nowrap;
      display: flex;
      align-items: center;
      will-change: transform;
      transform-origin: left center;
      padding-right: ${space(2)};

      img {
        width: 16px;
        height: 16px;
      }
    }
  }

  .TraceRightColumn {
    height: 100%;
    overflow: hidden;
    position: relative;
    display: flex;
    align-items: center;
    will-change: width;
    z-index: 1;
    cursor: pointer;

    width: calc(var(--span-column-width) * 100%);

    &:hover {
      .TraceArrow.Visible {
        opacity: 1;
        transition: 300ms 300ms ease-out;
        pointer-events: auto;
      }
    }
  }

  .TraceBar {
    position: absolute;
    height: 16px;
    width: 100%;
    background-color: black;
    transform-origin: left center;

    &.Invisible {
      background-color: transparent !important;

      > div {
        height: 100%;
      }
    }

    svg {
      width: 14px;
      height: 14px;
    }
  }

  .TraceArrow {
    position: absolute;
    pointer-events: none;
    top: 0;
    width: 14px;
    height: 24px;
    opacity: 0;
    background-color: transparent;
    border: none;
    transition: 60ms ease-out;
    font-size: ${p => p.theme.fontSize.md};
    color: ${p => p.theme.tokens.content.secondary};
    padding: 0 2px;
    display: flex;
    align-items: center;

    svg {
      fill: ${p => p.theme.tokens.content.secondary};
    }

    &.Left {
      left: 0;
    }
    &.Right {
      right: 0;
      transform: rotate(180deg);
    }
  }

  .TraceBarDuration {
    display: inline-block;
    transform-origin: left center;
    font-size: ${p => p.theme.fontSize.xs};
    color: ${p => p.theme.tokens.content.secondary};
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
    position: absolute;
  }

  .TraceChildrenCount {
    height: 16px;
    white-space: nowrap;
    min-width: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 99px;
    padding: 0px 4px;
    transition: all 0.15s ease-in-out;
    background: ${p => p.theme.tokens.background.primary};
    border: 1.5px solid var(--row-children-button-border-color);
    line-height: 0;
    z-index: 1;
    font-size: 10px;
    box-shadow: ${p => p.theme.dropShadowLight};
    margin-right: 8px;

    .TraceChildrenCountContent {
      + .TraceChildrenCountAction {
        margin-left: 2px;
      }
    }

    .TraceChildrenCountAction {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .TraceActionsLoadingIndicator {
      margin: 0;
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background-color: ${p => p.theme.tokens.background.primary};

      animation: show 0.1s ease-in-out forwards;

      @keyframes show {
        from {
          opacity: 0;
          transform: translate(-50%, -50%) scale(0.86);
        }
        to {
          opacity: 1;
          transform: translate(-50%, -50%) scale(1);
        }
      }

      .loading-indicator {
        border-width: 2px;
      }

      .loading-message {
        display: none;
      }
    }

    svg {
      width: 7px;
      transition: none;
    }
  }

  .TraceChildrenCountWrapper {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    min-width: 44px;
    height: 100%;
    position: relative;

    button {
      transition: none;
    }

    svg {
      fill: currentColor;
    }

    &.Orphaned {
      .TraceVerticalConnector,
      .TraceVerticalLastChildConnector,
      .TraceExpandedVerticalConnector {
        border-left: 2px dashed ${p => p.theme.tokens.border.primary};
      }

      &::before {
        border-bottom: 2px dashed ${p => p.theme.tokens.border.primary};
      }
    }

    &.Root {
      &:before,
      .TraceVerticalLastChildConnector {
        visibility: hidden;
      }
    }

    &::before {
      content: '';
      display: block;
      width: 50%;
      height: 2px;
      border-bottom: 2px solid ${p => p.theme.tokens.border.primary};
      position: absolute;
      left: 0;
      top: 50%;
      transform: translateY(-50%);
    }

    &::after {
      content: '';
      background-color: ${p => p.theme.tokens.border.primary};
      border-radius: 50%;
      height: 6px;
      width: 6px;
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translateY(-50%);
    }
  }

  .TraceVerticalConnector {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    height: 100%;
    width: 2px;
    border-left: 2px solid ${p => p.theme.tokens.border.primary};

    &.Orphaned {
      border-left: 2px dashed ${p => p.theme.tokens.border.primary};
    }
  }

  .TraceVerticalLastChildConnector {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    height: 50%;
    width: 2px;
    border-left: 2px solid ${p => p.theme.tokens.border.primary};
    border-bottom-left-radius: 4px;
  }

  .TraceExpandedVerticalConnector {
    position: absolute;
    bottom: 0;
    height: 50%;
    left: 50%;
    width: 2px;
    border-left: 2px solid ${p => p.theme.tokens.border.primary};
  }

  .TraceOperation {
    margin-left: 4px;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: ${p => p.theme.fontWeight.bold};
  }

  .TraceEmDash {
    margin-left: 4px;
  }

  .TraceDescription {
    margin-left: 4px;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
`;
