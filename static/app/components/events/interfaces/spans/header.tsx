import {Component, Fragment, PureComponent} from 'react';
import styled from '@emotion/styled';

import {
  getDataPoints,
  MIN_DATA_POINTS,
  MS_PER_S,
  ProfilingMeasurements,
} from 'sentry/components/events/interfaces/spans/profilingMeasurements';
import OpsBreakdown from 'sentry/components/events/opsBreakdown';
import {
  DividerSpacer,
  ScrollbarContainer,
  VirtualScrollbar,
  VirtualScrollbarGrip,
} from 'sentry/components/performance/waterfall/miniHeader';
import {
  getHumanDuration,
  pickBarColor,
  rectOfContent,
} from 'sentry/components/performance/waterfall/utils';
import {space} from 'sentry/styles/space';
import type {AggregateEventTransaction, EventTransaction} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {isDemoModeEnabled} from 'sentry/utils/demoMode';
import toPercent from 'sentry/utils/number/toPercent';
import theme from 'sentry/utils/theme';
import {ProfileContext} from 'sentry/views/profiling/profilesProvider';

import {DEMO_HEADER_HEIGHT_PX} from '../../../demo/demoHeader';

import {
  MINIMAP_CONTAINER_HEIGHT,
  MINIMAP_HEIGHT,
  PROFILE_MEASUREMENTS_CHART_HEIGHT,
  TIME_AXIS_HEIGHT,
  VIEW_HANDLE_HEIGHT,
} from './constants';
import * as CursorGuideHandler from './cursorGuideHandler';
import * as DividerHandlerManager from './dividerHandlerManager';
import type {DragManagerChildrenProps} from './dragManager';
import type {ActiveOperationFilter} from './filter';
import MeasurementsPanel from './measurementsPanel';
import * as ScrollbarManager from './scrollbarManager';
import type {EnhancedProcessedSpanType, ParsedTraceType, RawSpanType} from './types';
import {TickAlignment} from './types';
import type {SpanBoundsType, SpanGeneratedBoundsType} from './utils';
import {boundsGenerator, getMeasurements, getSpanOperation} from './utils';

type PropType = {
  dragProps: DragManagerChildrenProps;
  event: EventTransaction | AggregateEventTransaction;
  generateBounds: (bounds: SpanBoundsType) => SpanGeneratedBoundsType;
  isEmbedded: boolean;
  minimapInteractiveRef: React.RefObject<HTMLDivElement>;
  operationNameFilters: ActiveOperationFilter;
  organization: Organization;
  rootSpan: RawSpanType;
  spans: EnhancedProcessedSpanType[];
  trace: ParsedTraceType;
  traceViewHeaderRef: React.RefObject<HTMLDivElement>;
  virtualScrollBarContainerRef: React.RefObject<HTMLDivElement>;
};

type State = {
  minimapWidth: number | undefined;
};

class TraceViewHeader extends Component<PropType, State> {
  state: State = {
    minimapWidth: undefined,
  };

  componentDidMount() {
    this.fetchMinimapWidth();
  }

  componentDidUpdate() {
    this.fetchMinimapWidth();
  }

  fetchMinimapWidth() {
    const {minimapInteractiveRef} = this.props;
    if (minimapInteractiveRef.current) {
      const minimapWidth = minimapInteractiveRef.current.getBoundingClientRect().width;
      if (minimapWidth !== this.state.minimapWidth) {
        this.setState({
          minimapWidth,
        });
      }
    }
  }

  renderCursorGuide({
    cursorGuideHeight,
    showCursorGuide,
    mouseLeft,
  }: {
    cursorGuideHeight: number;
    mouseLeft: number | undefined;
    showCursorGuide: boolean;
  }) {
    if (!showCursorGuide || !mouseLeft) {
      return null;
    }

    return (
      <CursorGuide
        style={{
          left: toPercent(mouseLeft),
          height: `${cursorGuideHeight}px`,
        }}
      />
    );
  }

  renderViewHandles(
    {
      isDragging,
      onLeftHandleDragStart,
      leftHandlePosition,
      onRightHandleDragStart,
      rightHandlePosition,
      viewWindowStart,
      viewWindowEnd,
    }: DragManagerChildrenProps,
    hasProfileMeasurementsChart: boolean
  ) {
    const leftHandleGhost = isDragging ? (
      <Handle
        left={viewWindowStart}
        onMouseDown={() => {
          // do nothing
        }}
        isDragging={false}
        hasProfileMeasurementsChart={hasProfileMeasurementsChart}
      />
    ) : null;

    const leftHandle = (
      <Handle
        left={leftHandlePosition}
        onMouseDown={onLeftHandleDragStart}
        isDragging={isDragging}
        hasProfileMeasurementsChart={hasProfileMeasurementsChart}
      />
    );

    const rightHandle = (
      <Handle
        left={rightHandlePosition}
        onMouseDown={onRightHandleDragStart}
        isDragging={isDragging}
        hasProfileMeasurementsChart={hasProfileMeasurementsChart}
      />
    );

    const rightHandleGhost = isDragging ? (
      <Handle
        left={viewWindowEnd}
        onMouseDown={() => {
          // do nothing
        }}
        isDragging={false}
        hasProfileMeasurementsChart={hasProfileMeasurementsChart}
      />
    ) : null;

    return (
      <Fragment>
        {leftHandleGhost}
        {rightHandleGhost}
        {leftHandle}
        {rightHandle}
      </Fragment>
    );
  }

  renderFog(
    dragProps: DragManagerChildrenProps,
    hasProfileMeasurementsChart: boolean = false
  ) {
    return (
      <Fragment>
        <Fog
          style={{
            height: hasProfileMeasurementsChart
              ? `calc(100% - ${TIME_AXIS_HEIGHT}px)`
              : '100%',
            width: toPercent(dragProps.viewWindowStart),
          }}
        />
        <Fog
          style={{
            height: hasProfileMeasurementsChart
              ? `calc(100% - ${TIME_AXIS_HEIGHT}px)`
              : '100%',
            width: toPercent(1 - dragProps.viewWindowEnd),
            left: toPercent(dragProps.viewWindowEnd),
          }}
        />
      </Fragment>
    );
  }

  renderDurationGuide({
    showCursorGuide,
    mouseLeft,
  }: {
    mouseLeft: number | undefined;
    showCursorGuide: boolean;
  }) {
    if (!showCursorGuide || !mouseLeft) {
      return null;
    }

    const interactiveLayer = this.props.minimapInteractiveRef.current;

    if (!interactiveLayer) {
      return null;
    }

    const rect = rectOfContent(interactiveLayer);

    const {trace} = this.props;

    const duration =
      mouseLeft * Math.abs(trace.traceEndTimestamp - trace.traceStartTimestamp);

    const style = {top: 0, left: `calc(${mouseLeft * 100}% + 4px)`};

    const alignLeft = (1 - mouseLeft) * rect.width <= 100;

    return (
      <DurationGuideBox style={style} alignLeft={alignLeft}>
        <span>{getHumanDuration(duration)}</span>
      </DurationGuideBox>
    );
  }

  renderTicks() {
    const {trace} = this.props;
    const {minimapWidth} = this.state;

    const duration = Math.abs(trace.traceEndTimestamp - trace.traceStartTimestamp);

    let numberOfParts = 5;
    if (minimapWidth) {
      if (minimapWidth <= 350) {
        numberOfParts = 4;
      }
      if (minimapWidth <= 280) {
        numberOfParts = 3;
      }
      if (minimapWidth <= 160) {
        numberOfParts = 2;
      }
      if (minimapWidth <= 130) {
        numberOfParts = 1;
      }
    }

    if (numberOfParts === 1) {
      return (
        <TickLabel
          key="1"
          duration={duration * 0.5}
          style={{
            left: toPercent(0.5),
          }}
        />
      );
    }

    const segment = 1 / (numberOfParts - 1);

    const ticks: React.ReactNode[] = [];
    for (let currentPart = 0; currentPart < numberOfParts; currentPart++) {
      if (currentPart === 0) {
        ticks.push(
          <TickLabel
            key="first"
            align={TickAlignment.LEFT}
            hideTickMarker
            duration={0}
            style={{
              left: space(1),
            }}
          />
        );
        continue;
      }

      if (currentPart === numberOfParts - 1) {
        ticks.push(
          <TickLabel
            key="last"
            duration={duration}
            align={TickAlignment.RIGHT}
            hideTickMarker
            style={{
              right: space(1),
            }}
          />
        );
        continue;
      }

      const progress = segment * currentPart;

      ticks.push(
        <TickLabel
          key={String(currentPart)}
          duration={duration * progress}
          style={{
            left: toPercent(progress),
          }}
        />
      );
    }

    return ticks;
  }

  renderTimeAxis({
    showCursorGuide,
    mouseLeft,
    hasProfileMeasurementsChart,
  }: {
    hasProfileMeasurementsChart: boolean;
    mouseLeft: number | undefined;
    showCursorGuide: boolean;
  }) {
    return (
      <TimeAxis hasProfileMeasurementsChart={hasProfileMeasurementsChart}>
        {this.renderTicks()}
        {this.renderCursorGuide({
          showCursorGuide,
          mouseLeft,
          cursorGuideHeight: TIME_AXIS_HEIGHT,
        })}
        {this.renderDurationGuide({
          showCursorGuide,
          mouseLeft,
        })}
      </TimeAxis>
    );
  }

  renderWindowSelection(dragProps: DragManagerChildrenProps) {
    if (!dragProps.isWindowSelectionDragging) {
      return null;
    }

    const left = Math.min(
      dragProps.windowSelectionInitial,
      dragProps.windowSelectionCurrent
    );

    return (
      <WindowSelection
        style={{
          left: toPercent(left),
          width: toPercent(dragProps.windowSelectionSize),
        }}
      />
    );
  }

  generateBounds() {
    const {dragProps, trace} = this.props;

    return boundsGenerator({
      traceStartTimestamp: trace.traceStartTimestamp,
      traceEndTimestamp: trace.traceEndTimestamp,
      viewStart: dragProps.viewWindowStart,
      viewEnd: dragProps.viewWindowEnd,
    });
  }

  renderSecondaryHeader(hasProfileMeasurementsChart: boolean = false) {
    const {event} = this.props;

    const hasMeasurements = Object.keys(event.measurements ?? {}).length > 0;

    return (
      <DividerHandlerManager.Consumer>
        {dividerHandlerChildrenProps => {
          const {dividerPosition} = dividerHandlerChildrenProps;

          return (
            <SecondaryHeader hasProfileMeasurementsChart={hasProfileMeasurementsChart}>
              <ScrollbarManager.Consumer>
                {({virtualScrollbarRef, scrollBarAreaRef, onDragStart, onScroll}) => {
                  return (
                    <ScrollbarContainer
                      ref={this.props.virtualScrollBarContainerRef}
                      style={{
                        // the width of this component is shrunk to compensate for half of the width of the divider line
                        width: `calc(${toPercent(dividerPosition)} - 0.5px)`,
                      }}
                      onScroll={onScroll}
                    >
                      <div
                        style={{
                          width: 0,
                          height: '1px',
                        }}
                        ref={scrollBarAreaRef}
                      />
                      <VirtualScrollbar
                        data-type="virtual-scrollbar"
                        ref={virtualScrollbarRef}
                        onMouseDown={onDragStart}
                      >
                        <VirtualScrollbarGrip />
                      </VirtualScrollbar>
                    </ScrollbarContainer>
                  );
                }}
              </ScrollbarManager.Consumer>
              <DividerSpacer />
              {hasMeasurements ? (
                <MeasurementsPanel
                  measurements={getMeasurements(event, this.generateBounds())}
                  generateBounds={this.generateBounds()}
                  dividerPosition={dividerPosition}
                />
              ) : null}
            </SecondaryHeader>
          );
        }}
      </DividerHandlerManager.Consumer>
    );
  }

  render() {
    const {organization, trace} = this.props;
    const handleStartWindowSelection = (event: React.MouseEvent<HTMLDivElement>) => {
      const target = event.target;

      if (
        target instanceof Element &&
        target.getAttribute &&
        target.getAttribute('data-ignore')
      ) {
        // ignore this event if we need to
        return;
      }

      this.props.dragProps.onWindowSelectionDragStart(event);
    };

    return (
      <ProfileContext.Consumer>
        {profiles => {
          const transactionDuration = Math.abs(
            trace.traceEndTimestamp - trace.traceStartTimestamp
          );
          const hasProfileMeasurementsChart =
            organization.features.includes('mobile-cpu-memory-in-transactions') &&
            profiles?.type === 'resolved' &&
            // Check that this profile is for android
            'metadata' in profiles.data &&
            profiles.data.metadata.platform === 'android' &&
            // Check that this profile has measurements
            'measurements' in profiles.data &&
            defined(profiles.data.measurements?.cpu_usage) &&
            // Check that this profile has enough data points
            getDataPoints(
              profiles.data.measurements.cpu_usage,
              transactionDuration * MS_PER_S
            ).length >= MIN_DATA_POINTS;

          return (
            <HeaderContainer
              ref={this.props.traceViewHeaderRef}
              hasProfileMeasurementsChart={hasProfileMeasurementsChart}
              isEmbedded={this.props.isEmbedded}
            >
              <DividerHandlerManager.Consumer>
                {dividerHandlerChildrenProps => {
                  const {dividerPosition} = dividerHandlerChildrenProps;
                  return (
                    <Fragment>
                      <OperationsBreakdown
                        style={{
                          width: `calc(${toPercent(dividerPosition)} - 0.5px)`,
                        }}
                      >
                        {this.props.event && (
                          <OpsBreakdown
                            operationNameFilters={this.props.operationNameFilters}
                            event={this.props.event}
                            topN={3}
                            hideHeader
                          />
                        )}
                      </OperationsBreakdown>
                      <DividerSpacer
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: `calc(${toPercent(dividerPosition)} - 0.5px)`,
                          height: `${MINIMAP_HEIGHT + TIME_AXIS_HEIGHT}px`,
                        }}
                      />
                      <ActualMinimap
                        spans={this.props.spans}
                        generateBounds={this.props.generateBounds}
                        dividerPosition={dividerPosition}
                        rootSpan={this.props.rootSpan}
                      />
                      <CursorGuideHandler.Consumer>
                        {({
                          displayCursorGuide,
                          hideCursorGuide,
                          mouseLeft,
                          showCursorGuide,
                        }) => (
                          <RightSidePane
                            ref={this.props.minimapInteractiveRef}
                            style={{
                              width: `calc(${toPercent(1 - dividerPosition)} - 0.5px)`,
                              left: `calc(${toPercent(dividerPosition)} + 0.5px)`,
                            }}
                            onMouseEnter={event => {
                              displayCursorGuide(event.pageX);
                            }}
                            onMouseLeave={() => {
                              hideCursorGuide();
                            }}
                            onMouseMove={event => {
                              displayCursorGuide(event.pageX);
                            }}
                            onMouseDown={handleStartWindowSelection}
                          >
                            <MinimapContainer>
                              {this.renderFog(this.props.dragProps)}
                              {this.renderCursorGuide({
                                showCursorGuide,
                                mouseLeft,
                                cursorGuideHeight: MINIMAP_HEIGHT,
                              })}
                              {this.renderViewHandles(
                                this.props.dragProps,
                                hasProfileMeasurementsChart
                              )}
                              {this.renderWindowSelection(this.props.dragProps)}
                            </MinimapContainer>
                            {this.renderTimeAxis({
                              showCursorGuide,
                              mouseLeft,
                              hasProfileMeasurementsChart,
                            })}
                          </RightSidePane>
                        )}
                      </CursorGuideHandler.Consumer>
                      {hasProfileMeasurementsChart && (
                        <ProfilingMeasurements
                          transactionDuration={transactionDuration}
                          profileData={profiles.data}
                          renderCursorGuide={this.renderCursorGuide}
                          renderFog={() => this.renderFog(this.props.dragProps, true)}
                          renderWindowSelection={() =>
                            this.renderWindowSelection(this.props.dragProps)
                          }
                          onStartWindowSelection={handleStartWindowSelection}
                        />
                      )}
                      {this.renderSecondaryHeader(hasProfileMeasurementsChart)}
                    </Fragment>
                  );
                }}
              </DividerHandlerManager.Consumer>
            </HeaderContainer>
          );
        }}
      </ProfileContext.Consumer>
    );
  }
}

class ActualMinimap extends PureComponent<{
  dividerPosition: number;
  generateBounds: (bounds: SpanBoundsType) => SpanGeneratedBoundsType;
  rootSpan: RawSpanType;
  spans: EnhancedProcessedSpanType[];
}> {
  renderRootSpan(): React.ReactNode {
    const {spans, generateBounds} = this.props;

    return spans.map((payload, i) => {
      switch (payload.type) {
        case 'root_span':
        case 'span':
        case 'span_group_chain': {
          const {span} = payload;

          const spanBarColor: string = pickBarColor(getSpanOperation(span));

          const bounds = generateBounds({
            startTimestamp: span.start_timestamp,
            endTimestamp: span.timestamp,
          });
          const {left: spanLeft, width: spanWidth} = this.getBounds(bounds);

          return (
            <MinimapSpanBar
              key={`${payload.type}-${i}`}
              style={{
                backgroundColor:
                  payload.type === 'span_group_chain' ? theme.blue300 : spanBarColor,
                left: spanLeft,
                width: spanWidth,
              }}
            />
          );
        }
        case 'span_group_siblings': {
          const {spanSiblingGrouping} = payload;

          return (
            <MinimapSiblingGroupBar
              data-test-id="minimap-sibling-group-bar"
              key={`${payload.type}-${i}`}
            >
              {spanSiblingGrouping?.map(({span}, index) => {
                const bounds = generateBounds({
                  startTimestamp: span.start_timestamp,
                  endTimestamp: span.timestamp,
                });
                const {left: spanLeft, width: spanWidth} = this.getBounds(bounds);

                return (
                  <MinimapSpanBar
                    style={{
                      backgroundColor: theme.blue300,
                      left: spanLeft,
                      width: spanWidth,
                      minWidth: 0,
                      position: 'absolute',
                    }}
                    key={index}
                  />
                );
              })}
            </MinimapSiblingGroupBar>
          );
        }
        default: {
          return null;
        }
      }
    });
  }

  getBounds(bounds: SpanGeneratedBoundsType): {
    left: string;
    width: string;
  } {
    switch (bounds.type) {
      case 'TRACE_TIMESTAMPS_EQUAL':
      case 'INVALID_VIEW_WINDOW': {
        return {
          left: toPercent(0),
          width: '0px',
        };
      }

      case 'TIMESTAMPS_EQUAL': {
        return {
          left: toPercent(bounds.start),
          width: `${bounds.width}px`,
        };
      }
      case 'TIMESTAMPS_REVERSED':
      case 'TIMESTAMPS_STABLE': {
        return {
          left: toPercent(bounds.start),
          width: toPercent(bounds.end - bounds.start),
        };
      }
      default: {
        const _exhaustiveCheck: never = bounds;
        return _exhaustiveCheck;
      }
    }
  }

  render() {
    const {dividerPosition} = this.props;
    return (
      <MinimapBackground
        style={{
          // the width of this component is shrunk to compensate for half of the width of the divider line
          width: `calc(${toPercent(1 - dividerPosition)} - 0.5px)`,
          left: `calc(${toPercent(dividerPosition)} + 0.5px)`,
        }}
      >
        <BackgroundSlider id="minimap-background-slider">
          {this.renderRootSpan()}
        </BackgroundSlider>
      </MinimapBackground>
    );
  }
}

const TimeAxis = styled('div')<{hasProfileMeasurementsChart: boolean}>`
  width: 100%;
  position: absolute;
  left: 0;
  top: ${p =>
    p.hasProfileMeasurementsChart
      ? MINIMAP_HEIGHT + PROFILE_MEASUREMENTS_CHART_HEIGHT
      : MINIMAP_HEIGHT}px;
  border-top: 1px solid ${p => p.theme.border};
  height: ${TIME_AXIS_HEIGHT}px;
  background-color: ${p => p.theme.background};
  color: ${p => p.theme.gray300};
  font-size: 10px;
  ${p => p.theme.fontWeightNormal};
  font-variant-numeric: tabular-nums;
  overflow: hidden;
`;

const TickLabelContainer = styled('div')`
  height: ${TIME_AXIS_HEIGHT}px;
  position: absolute;
  top: 0;
  display: flex;
  align-items: center;
  user-select: none;
`;

const TickText = styled('span')<{align: TickAlignment}>`
  position: absolute;
  line-height: 1;
  white-space: nowrap;

  ${({align}) => {
    switch (align) {
      case TickAlignment.CENTER: {
        return 'transform: translateX(-50%)';
      }
      case TickAlignment.LEFT: {
        return null;
      }

      case TickAlignment.RIGHT: {
        return 'transform: translateX(-100%)';
      }

      default: {
        throw Error(`Invalid tick alignment: ${align}`);
      }
    }
  }};
`;

const TickMarker = styled('div')`
  width: 1px;
  height: 4px;
  background-color: ${p => p.theme.gray200};
  position: absolute;
  top: 0;
  left: 0;
  transform: translateX(-50%);
`;

function TickLabel(props: {
  duration: number;
  style: React.CSSProperties;
  align?: TickAlignment;
  hideTickMarker?: boolean;
}) {
  const {style, duration, hideTickMarker = false, align = TickAlignment.CENTER} = props;

  return (
    <TickLabelContainer style={style}>
      {hideTickMarker ? null : <TickMarker />}
      <TickText align={align}>{getHumanDuration(duration)}</TickText>
    </TickLabelContainer>
  );
}

const DurationGuideBox = styled('div')<{alignLeft: boolean}>`
  position: absolute;
  background-color: ${p => p.theme.background};
  padding: 4px;
  height: 100%;
  border-radius: 3px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  line-height: 1;
  white-space: nowrap;

  ${({alignLeft}) => {
    if (!alignLeft) {
      return null;
    }

    return 'transform: translateX(-100%) translateX(-8px);';
  }};
`;

export const HeaderContainer = styled('div')<{
  hasProfileMeasurementsChart: boolean;
  isEmbedded: boolean;
}>`
  width: 100%;
  position: sticky;
  left: 0;
  top: ${() => (isDemoModeEnabled() ? DEMO_HEADER_HEIGHT_PX : 0)};
  z-index: ${p => (p.isEmbedded ? 'initial' : p.theme.zIndex.traceView.minimapContainer)};
  background-color: ${p => p.theme.background};
  border-bottom: 1px solid ${p => p.theme.border};
  height: ${p =>
    p.hasProfileMeasurementsChart
      ? MINIMAP_CONTAINER_HEIGHT + PROFILE_MEASUREMENTS_CHART_HEIGHT
      : MINIMAP_CONTAINER_HEIGHT}px;
  border-top-left-radius: ${p => p.theme.borderRadius};
  border-top-right-radius: ${p => p.theme.borderRadius};
`;

export const MinimapBackground = styled('div')`
  height: ${MINIMAP_HEIGHT}px;
  max-height: ${MINIMAP_HEIGHT}px;
  overflow: hidden;
  position: absolute;
  top: 0;
`;

const MinimapContainer = styled('div')`
  height: ${MINIMAP_HEIGHT}px;
  width: 100%;
  position: relative;
  left: 0;
`;

const ViewHandleContainer = styled('div')`
  position: absolute;
  top: 0;
  height: 100%;
  z-index: 1;
`;

const ViewHandleLine = styled('div')`
  height: calc(100% - ${VIEW_HANDLE_HEIGHT}px);
  width: 2px;
  background-color: ${p => p.theme.textColor};
`;

const ViewHandle = styled('div')<{isDragging: boolean}>`
  position: absolute;
  background-color: ${p => p.theme.textColor};
  cursor: col-resize;
  width: 8px;
  height: ${VIEW_HANDLE_HEIGHT}px;
  bottom: 0;
  left: -3px;
`;

const Fog = styled('div')`
  background-color: ${p => p.theme.textColor};
  opacity: 0.1;
  position: absolute;
  top: 0;
`;

const MinimapSpanBar = styled('div')`
  position: relative;
  height: 2px;
  min-height: 2px;
  max-height: 2px;
  margin: 2px 0;
  min-width: 1px;
  border-radius: 1px;
  box-sizing: border-box;
`;

const MinimapSiblingGroupBar = styled('div')`
  display: flex;
  position: relative;
  height: 2px;
  min-height: 2px;
  max-height: 2px;
  top: -2px;
`;

const BackgroundSlider = styled('div')`
  position: relative;
`;

const CursorGuide = styled('div')`
  position: absolute;
  top: 0;
  width: 1px;
  background-color: ${p => p.theme.red300};
  transform: translateX(-50%);
`;

function Handle({
  left,
  onMouseDown,
  isDragging,
  hasProfileMeasurementsChart,
}: {
  hasProfileMeasurementsChart: boolean;
  isDragging: boolean;
  left: number;
  onMouseDown: (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
}) {
  return (
    <ViewHandleContainer
      style={{
        left: toPercent(left),
        height: `${
          hasProfileMeasurementsChart
            ? MINIMAP_HEIGHT + PROFILE_MEASUREMENTS_CHART_HEIGHT
            : MINIMAP_HEIGHT
        }px`,
      }}
    >
      <ViewHandleLine />
      <ViewHandle
        data-ignore="true"
        onMouseDown={onMouseDown}
        isDragging={isDragging}
        style={{
          height: `${VIEW_HANDLE_HEIGHT}px`,
        }}
      />
    </ViewHandleContainer>
  );
}

const WindowSelection = styled('div')`
  position: absolute;
  top: 0;
  height: 100%;
  background-color: ${p => p.theme.textColor};
  opacity: 0.1;
`;

export const SecondaryHeader = styled('div')<{hasProfileMeasurementsChart?: boolean}>`
  position: absolute;
  top: ${p =>
    MINIMAP_HEIGHT +
    TIME_AXIS_HEIGHT +
    (p.hasProfileMeasurementsChart ? PROFILE_MEASUREMENTS_CHART_HEIGHT : 0)}px;
  left: 0;
  height: ${TIME_AXIS_HEIGHT}px;
  width: 100%;
  background-color: ${p => p.theme.backgroundSecondary};
  display: flex;
  border-top: 1px solid ${p => p.theme.border};
  overflow: hidden;
`;

const OperationsBreakdown = styled('div')`
  height: ${MINIMAP_HEIGHT + TIME_AXIS_HEIGHT}px;
  position: absolute;
  left: 0;
  top: 0;
  overflow: hidden;
`;

const RightSidePane = styled('div')`
  height: ${MINIMAP_HEIGHT + TIME_AXIS_HEIGHT}px;
  position: absolute;
  top: 0;
`;

export default TraceViewHeader;
export {ActualMinimap};
