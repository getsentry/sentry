import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import {SentryTransactionEvent} from 'app/types';

import * as CursorGuideHandler from './cursorGuideHandler';
import * as DividerHandlerManager from './dividerHandlerManager';
import {DragManagerChildrenProps} from './dragManager';
import MeasurementsPanel from './measurementsPanel';
import * as ScrollbarManager from './scrollbarManager';
import {zIndex} from './styles';
import {
  ParsedTraceType,
  RawSpanType,
  SpanChildrenLookupType,
  TickAlignment,
} from './types';
import {
  boundsGenerator,
  getHumanDuration,
  getSpanID,
  getSpanOperation,
  pickSpanBarColour,
  rectOfContent,
  SpanBoundsType,
  SpanGeneratedBoundsType,
  toPercent,
} from './utils';

export const MINIMAP_SPAN_BAR_HEIGHT = 4;
const MINIMAP_HEIGHT = 120;
export const NUM_OF_SPANS_FIT_IN_MINI_MAP = MINIMAP_HEIGHT / MINIMAP_SPAN_BAR_HEIGHT;
const TIME_AXIS_HEIGHT = 20;
const VIEW_HANDLE_HEIGHT = 18;
const SECONDARY_HEADER_HEIGHT = 20;
export const MINIMAP_CONTAINER_HEIGHT =
  MINIMAP_HEIGHT + TIME_AXIS_HEIGHT + SECONDARY_HEADER_HEIGHT + 1;

type PropType = {
  minimapInteractiveRef: React.RefObject<HTMLDivElement>;
  virtualScrollBarContainerRef: React.RefObject<HTMLDivElement>;
  dragProps: DragManagerChildrenProps;
  trace: ParsedTraceType;
  event: SentryTransactionEvent;
};

class TraceViewHeader extends React.Component<PropType> {
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

  renderTimeAxis({
    showCursorGuide,
    mouseLeft,
  }: {
    showCursorGuide: boolean;
    mouseLeft: number | undefined;
  }) {
    const {trace} = this.props;

    const duration = Math.abs(trace.traceEndTimestamp - trace.traceStartTimestamp);

    const firstTick = (
      <TickLabel
        align={TickAlignment.Left}
        hideTickMarker
        duration={0}
        style={{
          left: space(1),
        }}
      />
    );

    const secondTick = (
      <TickLabel
        duration={duration * 0.25}
        style={{
          left: '25%',
        }}
      />
    );

    const thirdTick = (
      <TickLabel
        duration={duration * 0.5}
        style={{
          left: '50%',
        }}
      />
    );

    const fourthTick = (
      <TickLabel
        duration={duration * 0.75}
        style={{
          left: '75%',
        }}
      />
    );

    const lastTick = (
      <TickLabel
        duration={duration}
        align={TickAlignment.Right}
        hideTickMarker
        style={{
          right: space(1),
        }}
      />
    );

    return (
      <TimeAxis>
        {firstTick}
        {secondTick}
        {thirdTick}
        {fourthTick}
        {lastTick}
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
              <ScrollBarContainer
                ref={this.props.virtualScrollBarContainerRef}
                style={{
                  // the width of this component is shrunk to compensate for half of the width of the divider line
                  width: `calc(${toPercent(dividerPosition)} - 0.5px)`,
                }}
              >
                <ScrollbarManager.Consumer>
                  {({virtualScrollbarRef, onDragStart}) => {
                    return (
                      <VirtualScrollBar
                        data-type="virtual-scrollbar"
                        ref={virtualScrollbarRef}
                        onMouseDown={onDragStart}
                      >
                        <VirtualScrollBarGrip />
                      </VirtualScrollBar>
                    );
                  }}
                </ScrollbarManager.Consumer>
              </ScrollBarContainer>
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
        <ActualMinimap trace={this.props.trace} />
        <CursorGuideHandler.Consumer>
          {({displayCursorGuide, hideCursorGuide, mouseLeft, showCursorGuide}) => (
            <div
              ref={this.props.minimapInteractiveRef}
              style={{
                width: '100%',
                height: `${MINIMAP_HEIGHT + TIME_AXIS_HEIGHT}px`,
                position: 'absolute',
                left: 0,
                top: 0,
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
            </div>
          )}
        </CursorGuideHandler.Consumer>
        {this.renderSecondaryHeader()}
      </HeaderContainer>
    );
  }
}

class ActualMinimap extends React.PureComponent<{trace: ParsedTraceType}> {
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

  getBounds(
    bounds: SpanGeneratedBoundsType
  ): {
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
    const spanBarColour: string = pickSpanBarColour(getSpanOperation(span));

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
              backgroundColor: spanBarColour,
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
    return (
      <MinimapBackground>
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
  top: 0;
  z-index: ${zIndex.minimapContainer};
  background-color: ${p => p.theme.background};
  border-bottom: 1px solid ${p => p.theme.border};
  height: ${MINIMAP_CONTAINER_HEIGHT}px;
`;

const MinimapBackground = styled('div')`
  height: ${MINIMAP_HEIGHT}px;
  max-height: ${MINIMAP_HEIGHT}px;
  overflow: hidden;
  width: 100%;
  position: absolute;
  top: 0;
  left: 0;
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
  background-color: rgba(108, 95, 199, 0.1);
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
  background-color: rgba(69, 38, 80, 0.1);
`;

const SecondaryHeader = styled('div')`
  position: absolute;
  top: ${MINIMAP_HEIGHT + TIME_AXIS_HEIGHT}px;
  left: 0;
  height: ${TIME_AXIS_HEIGHT}px;
  width: 100%;
  background-color: ${p => p.theme.backgroundSecondary};
  display: flex;
  border-top: 1px solid ${p => p.theme.border};
`;

const DividerSpacer = styled('div')`
  width: 1px;
  background-color: ${p => p.theme.gray200};
`;

const ScrollBarContainer = styled('div')`
  display: flex;
  align-items: center;
  width: 100%;
  height: ${SECONDARY_HEADER_HEIGHT}px;
  left: 0;
  bottom: 0;
  & > div[data-type='virtual-scrollbar'].dragging > div {
    background-color: ${p => p.theme.gray500};
    cursor: grabbing;
  }
`;

const VirtualScrollBar = styled('div')`
  height: 8px;
  width: 0;
  padding-left: 4px;
  padding-right: 4px;
  position: relative;
  top: 0;
  left: 0;
  cursor: grab;
`;

const VirtualScrollBarGrip = styled('div')`
  height: 8px;
  width: 100%;
  border-radius: 20px;
  transition: background-color 150ms ease;
  background-color: rgba(48, 40, 57, 0.5);
`;

export default TraceViewHeader;
