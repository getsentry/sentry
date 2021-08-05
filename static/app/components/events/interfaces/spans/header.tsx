import * as React from 'react';
import styled from '@emotion/styled';

import OpsBreakdown from 'app/components/events/opsBreakdown';
import {
  DividerSpacer,
  ScrollbarContainer,
  VirtualScrollbar,
  VirtualScrollbarGrip,
} from 'app/components/performance/waterfall/miniHeader';
import {
  getHumanDuration,
  pickBarColor,
  rectOfContent,
  toPercent,
} from 'app/components/performance/waterfall/utils';
import ConfigStore from 'app/stores/configStore';
import space from 'app/styles/space';
import {Organization} from 'app/types';
import {EventTransaction} from 'app/types/event';

import {
  MINIMAP_CONTAINER_HEIGHT,
  MINIMAP_HEIGHT,
  TIME_AXIS_HEIGHT,
  VIEW_HANDLE_HEIGHT,
} from './constants';
import * as CursorGuideHandler from './cursorGuideHandler';
import * as DividerHandlerManager from './dividerHandlerManager';
import {DragManagerChildrenProps} from './dragManager';
import {ActiveOperationFilter} from './filter';
import MeasurementsPanel from './measurementsPanel';
import * as ScrollbarManager from './scrollbarManager';
import {
  ParsedTraceType,
  RawSpanType,
  SpanChildrenLookupType,
  TickAlignment,
} from './types';
import {
  boundsGenerator,
  getSpanID,
  getSpanOperation,
  SpanBoundsType,
  SpanGeneratedBoundsType,
} from './utils';

type PropType = {
  organization: Organization;
  minimapInteractiveRef: React.RefObject<HTMLDivElement>;
  virtualScrollBarContainerRef: React.RefObject<HTMLDivElement>;
  dragProps: DragManagerChildrenProps;
  trace: ParsedTraceType;
  event: EventTransaction;
  operationNameFilters: ActiveOperationFilter;
};

type State = {
  minimapWidth: number | undefined;
};

class TraceViewHeader extends React.Component<PropType, State> {
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
        // eslint-disable-next-line react/no-did-update-set-state
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
    showCursorGuide: boolean;
    mouseLeft: number | undefined;
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

  renderViewHandles({
    isDragging,
    onLeftHandleDragStart,
    leftHandlePosition,
    onRightHandleDragStart,
    rightHandlePosition,
    viewWindowStart,
    viewWindowEnd,
  }: DragManagerChildrenProps) {
    const leftHandleGhost = isDragging ? (
      <Handle
        left={viewWindowStart}
        onMouseDown={() => {
          // do nothing
        }}
        isDragging={false}
      />
    ) : null;

    const leftHandle = (
      <Handle
        left={leftHandlePosition}
        onMouseDown={onLeftHandleDragStart}
        isDragging={isDragging}
      />
    );

    const rightHandle = (
      <Handle
        left={rightHandlePosition}
        onMouseDown={onRightHandleDragStart}
        isDragging={isDragging}
      />
    );

    const rightHandleGhost = isDragging ? (
      <Handle
        left={viewWindowEnd}
        onMouseDown={() => {
          // do nothing
        }}
        isDragging={false}
      />
    ) : null;

    return (
      <React.Fragment>
        {leftHandleGhost}
        {rightHandleGhost}
        {leftHandle}
        {rightHandle}
      </React.Fragment>
    );
  }

  renderFog(dragProps: DragManagerChildrenProps) {
    return (
      <React.Fragment>
        <Fog style={{height: '100%', width: toPercent(dragProps.viewWindowStart)}} />
        <Fog
          style={{
            height: '100%',
            width: toPercent(1 - dragProps.viewWindowEnd),
            left: toPercent(dragProps.viewWindowEnd),
          }}
        />
      </React.Fragment>
    );
  }

  renderDurationGuide({
    showCursorGuide,
    mouseLeft,
  }: {
    showCursorGuide: boolean;
    mouseLeft: number | undefined;
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
            align={TickAlignment.Left}
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
            align={TickAlignment.Right}
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
  }: {
    showCursorGuide: boolean;
    mouseLeft: number | undefined;
  }) {
    return (
      <TimeAxis>
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

  renderSecondaryHeader() {
    const {event} = this.props;

    const hasMeasurements = Object.keys(event.measurements ?? {}).length > 0;

    return (
      <DividerHandlerManager.Consumer>
        {dividerHandlerChildrenProps => {
          const {dividerPosition} = dividerHandlerChildrenProps;

          return (
            <SecondaryHeader>
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
                  event={event}
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
    return (
      <HeaderContainer>
        <DividerHandlerManager.Consumer>
          {dividerHandlerChildrenProps => {
            const {dividerPosition} = dividerHandlerChildrenProps;
            return (
              <React.Fragment>
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
                  trace={this.props.trace}
                  dividerPosition={dividerPosition}
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
                      onMouseDown={event => {
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
                      }}
                    >
                      <MinimapContainer>
                        {this.renderFog(this.props.dragProps)}
                        {this.renderCursorGuide({
                          showCursorGuide,
                          mouseLeft,
                          cursorGuideHeight: MINIMAP_HEIGHT,
                        })}
                        {this.renderViewHandles(this.props.dragProps)}
                        {this.renderWindowSelection(this.props.dragProps)}
                      </MinimapContainer>
                      {this.renderTimeAxis({
                        showCursorGuide,
                        mouseLeft,
                      })}
                    </RightSidePane>
                  )}
                </CursorGuideHandler.Consumer>
                {this.renderSecondaryHeader()}
              </React.Fragment>
            );
          }}
        </DividerHandlerManager.Consumer>
      </HeaderContainer>
    );
  }
}

class ActualMinimap extends React.PureComponent<{
  trace: ParsedTraceType;
  dividerPosition: number;
}> {
  renderRootSpan(): React.ReactNode {
    const {trace} = this.props;

    const generateBounds = boundsGenerator({
      traceStartTimestamp: trace.traceStartTimestamp,
      traceEndTimestamp: trace.traceEndTimestamp,
      viewStart: 0,
      viewEnd: 1,
    });

    const rootSpan: RawSpanType = {
      trace_id: trace.traceID,
      span_id: trace.rootSpanID,
      start_timestamp: trace.traceStartTimestamp,
      timestamp: trace.traceEndTimestamp,
      op: trace.op,
      data: {},
    };

    return this.renderSpan({
      spanNumber: 0,
      generateBounds,
      span: rootSpan,
      childSpans: trace.childSpans,
    }).spanTree;
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

  renderSpan({
    spanNumber,
    childSpans,
    generateBounds,
    span,
  }: {
    spanNumber: number;
    childSpans: SpanChildrenLookupType;
    generateBounds: (bounds: SpanBoundsType) => SpanGeneratedBoundsType;
    span: Readonly<RawSpanType>;
  }): {
    spanTree: JSX.Element;
    nextSpanNumber: number;
  } {
    const spanBarColor: string = pickBarColor(getSpanOperation(span));

    const bounds = generateBounds({
      startTimestamp: span.start_timestamp,
      endTimestamp: span.timestamp,
    });

    const {left: spanLeft, width: spanWidth} = this.getBounds(bounds);

    const spanChildren: Array<RawSpanType> = childSpans?.[getSpanID(span)] ?? [];

    // Mark descendents as being rendered. This is to address potential recursion issues due to malformed data.
    // For example if a span has a span_id that's identical to its parent_span_id.
    childSpans = {
      ...childSpans,
    };
    delete childSpans[getSpanID(span)];

    type AccType = {
      nextSpanNumber: number;
      renderedSpanChildren: Array<JSX.Element>;
    };

    const reduced: AccType = spanChildren.reduce(
      (acc: AccType, spanChild, index: number) => {
        const key = `${getSpanID(spanChild, String(index))}`;

        const results = this.renderSpan({
          spanNumber: acc.nextSpanNumber,
          childSpans,
          generateBounds,
          span: spanChild,
        });

        acc.renderedSpanChildren.push(
          <React.Fragment key={key}>{results.spanTree}</React.Fragment>
        );

        acc.nextSpanNumber = results.nextSpanNumber;

        return acc;
      },
      {
        renderedSpanChildren: [],
        nextSpanNumber: spanNumber + 1,
      }
    );

    return {
      nextSpanNumber: reduced.nextSpanNumber,
      spanTree: (
        <React.Fragment>
          <MinimapSpanBar
            style={{
              backgroundColor: spanBarColor,
              left: spanLeft,
              width: spanWidth,
            }}
          />
          {reduced.renderedSpanChildren}
        </React.Fragment>
      ),
    };
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

const TimeAxis = styled('div')`
  width: 100%;
  position: absolute;
  left: 0;
  top: ${MINIMAP_HEIGHT}px;
  border-top: 1px solid ${p => p.theme.border};
  height: ${TIME_AXIS_HEIGHT}px;
  background-color: ${p => p.theme.background};
  color: ${p => p.theme.gray300};
  font-size: 10px;
  font-weight: 500;
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
      case TickAlignment.Center: {
        return 'transform: translateX(-50%)';
      }
      case TickAlignment.Left: {
        return null;
      }

      case TickAlignment.Right: {
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

const TickLabel = (props: {
  style: React.CSSProperties;
  hideTickMarker?: boolean;
  align?: TickAlignment;
  duration: number;
}) => {
  const {style, duration, hideTickMarker = false, align = TickAlignment.Center} = props;

  return (
    <TickLabelContainer style={style}>
      {hideTickMarker ? null : <TickMarker />}
      <TickText align={align}>{getHumanDuration(duration)}</TickText>
    </TickLabelContainer>
  );
};

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

const HeaderContainer = styled('div')`
  width: 100%;
  position: sticky;
  left: 0;
  top: ${p => (ConfigStore.get('demoMode') ? p.theme.demo.headerSize : 0)};
  z-index: ${p => p.theme.zIndex.traceView.minimapContainer};
  background-color: ${p => p.theme.background};
  border-bottom: 1px solid ${p => p.theme.border};
  height: ${MINIMAP_CONTAINER_HEIGHT}px;
  border-top-left-radius: ${p => p.theme.borderRadius};
  border-top-right-radius: ${p => p.theme.borderRadius};
`;

const MinimapBackground = styled('div')`
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
  height: ${MINIMAP_HEIGHT}px;
`;

const ViewHandleLine = styled('div')`
  height: ${MINIMAP_HEIGHT - VIEW_HANDLE_HEIGHT}px;
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

const Handle = ({
  left,
  onMouseDown,
  isDragging,
}: {
  left: number;
  onMouseDown: (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
  isDragging: boolean;
}) => (
  <ViewHandleContainer
    style={{
      left: toPercent(left),
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

const WindowSelection = styled('div')`
  position: absolute;
  top: 0;
  height: ${MINIMAP_HEIGHT}px;
  background-color: ${p => p.theme.textColor};
  opacity: 0.1;
`;

export const SecondaryHeader = styled('div')`
  position: absolute;
  top: ${MINIMAP_HEIGHT + TIME_AXIS_HEIGHT}px;
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
