import React from 'react';
import styled from 'react-emotion';

import space from 'app/styles/space';
import {get} from 'lodash';

import {
  rectOfContent,
  clamp,
  toPercent,
  getHumanDuration,
  generateSpanColourPicker,
  boundsGenerator,
  SpanBoundsType,
  SpanGeneratedBoundsType,
  parseSpanTimestamps,
  TimestampStatus,
} from './utils';
import {DragManagerChildrenProps} from './dragManager';
import {ParsedTraceType, TickAlignment, SpanType, SpanChildrenLookupType} from './types';

export const MINIMAP_CONTAINER_HEIGHT = 106;
export const MINIMAP_SPAN_BAR_HEIGHT = 5;
const MINIMAP_HEIGHT = 75;
export const NUM_OF_SPANS_FIT_IN_MINI_MAP = MINIMAP_HEIGHT / MINIMAP_SPAN_BAR_HEIGHT;
const TIME_AXIS_HEIGHT = 30;

type PropType = {
  traceViewRef: React.RefObject<HTMLDivElement>;
  minimapInteractiveRef: React.RefObject<HTMLDivElement>;
  dragProps: DragManagerChildrenProps;
  trace: ParsedTraceType;
};

type StateType = {
  showCursorGuide: boolean;
  mousePageX: number | undefined;
  startViewHandleX: number;
};

class Minimap extends React.Component<PropType, StateType> {
  state: StateType = {
    showCursorGuide: false,
    mousePageX: void 0,
    startViewHandleX: 100,
  };

  renderCursorGuide = (cursorGuideHeight: number) => {
    if (!this.state.showCursorGuide || !this.state.mousePageX) {
      return null;
    }

    const interactiveLayer = this.props.minimapInteractiveRef.current;

    if (!interactiveLayer) {
      return null;
    }

    const rect = rectOfContent(interactiveLayer);

    // clamp mouseLeft to be within [0, 1]
    const mouseLeft = clamp((this.state.mousePageX - rect.x) / rect.width, 0, 1);

    return (
      <CursorGuide
        style={{
          left: toPercent(mouseLeft),
          height: `${cursorGuideHeight}px`,
        }}
      />
    );
  };

  renderViewHandles = ({
    isDragging,
    onLeftHandleDragStart,
    leftHandlePosition,
    onRightHandleDragStart,
    rightHandlePosition,
    viewWindowStart,
    viewWindowEnd,
  }: DragManagerChildrenProps) => {
    const leftHandleGhost = isDragging ? (
      <Handle
        left={viewWindowStart}
        onMouseDown={onLeftHandleDragStart}
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
        onMouseDown={onLeftHandleDragStart}
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
  };

  renderFog = (dragProps: DragManagerChildrenProps) => {
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
  };

  renderDurationGuide = () => {
    if (!this.state.showCursorGuide || !this.state.mousePageX) {
      return null;
    }

    const interactiveLayer = this.props.minimapInteractiveRef.current;

    if (!interactiveLayer) {
      return null;
    }

    const rect = rectOfContent(interactiveLayer);

    // clamp mouseLeft to be within [0, 1]
    const mouseLeft = clamp((this.state.mousePageX - rect.x) / rect.width, 0, 1);

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
  };

  renderTimeAxis = () => {
    const {trace} = this.props;

    const duration = Math.abs(trace.traceEndTimestamp - trace.traceStartTimestamp);

    const firstTick = (
      <TickLabel
        align={TickAlignment.Left}
        hideTickMarker={true}
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
        hideTickMarker={true}
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
        {this.renderCursorGuide(TIME_AXIS_HEIGHT)}
        {this.renderDurationGuide()}
      </TimeAxis>
    );
  };

  render() {
    return (
      <React.Fragment>
        <MinimapContainer>
          <ActualMinimap trace={this.props.trace} />
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
              this.setState({
                showCursorGuide: true,
                mousePageX: event.pageX,
              });
            }}
            onMouseLeave={() => {
              this.setState({showCursorGuide: false, mousePageX: void 0});
            }}
            onMouseMove={event => {
              this.setState({
                showCursorGuide: true,
                mousePageX: event.pageX,
              });
            }}
          >
            <InteractiveLayer>
              {this.renderFog(this.props.dragProps)}
              {this.renderCursorGuide(MINIMAP_HEIGHT)}
              {this.renderViewHandles(this.props.dragProps)}
            </InteractiveLayer>
            {this.renderTimeAxis()}
          </div>
        </MinimapContainer>
      </React.Fragment>
    );
  }
}

class ActualMinimap extends React.PureComponent<{trace: ParsedTraceType}> {
  drawMinimap = () => {
    return this.renderRootSpan();
  };

  renderRootSpan = () => {
    const {trace} = this.props;

    const pickSpanBarColour = generateSpanColourPicker();

    const generateBounds = boundsGenerator({
      traceStartTimestamp: trace.traceStartTimestamp,
      traceEndTimestamp: trace.traceEndTimestamp,
      viewStart: 0,
      viewEnd: 1,
    });

    const rootSpan: SpanType = {
      trace_id: trace.traceID,
      span_id: trace.rootSpanID,
      start_timestamp: trace.traceStartTimestamp,
      timestamp: trace.traceEndTimestamp,
      data: {},
    };

    return this.renderSpan({
      pickSpanBarColour,
      generateBounds,
      span: rootSpan,
      spanID: trace.rootSpanID,
      lookup: trace.lookup,
    });
  };

  renderSpan = ({
    spanID,
    pickSpanBarColour,
    lookup,
    generateBounds,
    span,
  }: {
    spanID: string;
    pickSpanBarColour: () => string;
    lookup: Readonly<SpanChildrenLookupType>;
    generateBounds: (bounds: SpanBoundsType) => SpanGeneratedBoundsType;
    span: Readonly<SpanType>;
  }): JSX.Element => {
    const spanBarColour: string = pickSpanBarColour();

    const bounds = generateBounds({
      startTimestamp: span.start_timestamp,
      endTimestamp: span.timestamp,
    });

    const timestampStatus = parseSpanTimestamps(span);

    const spanLeft = timestampStatus === TimestampStatus.Stable ? bounds.start : 0;
    const spanWidth =
      timestampStatus === TimestampStatus.Stable ? bounds.end - bounds.start : 1;

    const spanChildren: Array<SpanType> = get(lookup, spanID, []);

    type AccType = Array<JSX.Element>;

    const reduced: AccType = spanChildren.reduce((acc: AccType, spanChild) => {
      const key = `${spanChild.span_id}`;

      const results = this.renderSpan({
        spanID: spanChild.span_id,
        lookup,
        pickSpanBarColour,
        generateBounds,
        span: spanChild,
      });

      acc.push(<React.Fragment key={key}>{results}</React.Fragment>);

      return acc;
    }, []);

    return (
      <React.Fragment>
        <MinimapSpanBar
          style={{
            backgroundColor: spanBarColour,
            left: toPercent(spanLeft),
            width: toPercent(spanWidth),
          }}
        />
        {reduced}
      </React.Fragment>
    );
  };

  render() {
    return (
      <MinimapBackground>
        <BackgroundSlider id="minimap-background-slider">
          {this.drawMinimap()}
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

  border-top: 1px solid #d1cad8;

  height: ${TIME_AXIS_HEIGHT}px;
  background-color: #faf9fb;

  color: #9585a3;
  font-size: 10px;
  font-weight: 500;
`;

const TickLabelContainer = styled('div')`
  height: ${TIME_AXIS_HEIGHT}px;

  position: absolute;
  top: 0;

  user-select: none;
`;

const TickText = styled('span')`
  line-height: 1;

  position: absolute;
  bottom: 8px;
  white-space: nowrap;

  ${({align}: {align: TickAlignment}) => {
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
  height: 5px;

  background-color: #d1cad8;

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

const DurationGuideBox = styled('div')`
  position: absolute;

  background-color: rgba(255, 255, 255, 1);
  padding: 4px;

  border-radius: 3px;
  border: 1px solid rgba(0, 0, 0, 0.1);

  height: 16px;

  line-height: 1;
  vertical-align: middle;

  transform: translateY(50%);

  white-space: nowrap;

  ${({alignLeft}: {alignLeft: boolean}) => {
    if (!alignLeft) {
      return null;
    }

    return 'transform: translateY(50%) translateX(-100%) translateX(-8px);';
  }};
`;

const MinimapContainer = styled('div')`
  width: 100%;
  position: sticky;
  left: 0;
  top: 0;
  z-index: 99999999999;

  background-color: #fff;

  border-bottom: 1px solid #d1cad8;

  height: ${MINIMAP_HEIGHT + TIME_AXIS_HEIGHT + 1}px;
`;

const MinimapBackground = styled('div')`
  height: ${MINIMAP_HEIGHT}px;
  max-height: ${MINIMAP_HEIGHT}px;
  overflow-y: hidden;
  width: 100%;
  position: absolute;
  top: 0;
  left: 0;
`;

const InteractiveLayer = styled('div')`
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

const ViewHandle = styled('div')`
  position: absolute;
  top: 0;

  background-color: #6c5fc7;

  cursor: col-resize;

  height: 20px;

  ${({isDragging}: {isDragging: boolean}) => {
    if (isDragging) {
      return `
      width: 6px;
      transform: translate(-3px, ${MINIMAP_HEIGHT - 20}px);
      `;
    }

    return `
    width: 4px;
    transform: translate(-2px, ${MINIMAP_HEIGHT - 20}px);
    `;
  }};

  &:hover {
    width: 6px;
    transform: translate(-3px, ${MINIMAP_HEIGHT - 20}px);
  }
`;

const Fog = styled('div')`
  background-color: rgba(241, 245, 251, 0.5);
  position: absolute;
  top: 0;
`;

const MinimapSpanBar = styled('div')`
  position: relative;
  height: ${MINIMAP_SPAN_BAR_HEIGHT}px;
  min-height: ${MINIMAP_SPAN_BAR_HEIGHT}px;
  max-height: ${MINIMAP_SPAN_BAR_HEIGHT}px;
`;

const BackgroundSlider = styled('div')`
  position: relative;
`;

const CursorGuide = styled('div')`
  position: absolute;
  top: 0;
  width: 1px;
  background-color: #e03e2f;

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
}) => {
  return (
    <ViewHandleContainer
      style={{
        left: toPercent(left),
      }}
    >
      <svg
        width={1}
        height={MINIMAP_HEIGHT - 20}
        fill="none"
        style={{width: '1px', overflow: 'visible'}}
      >
        <line
          x1="0"
          x2="0"
          y1="0"
          y2={MINIMAP_HEIGHT - 20}
          strokeWidth="1"
          strokeDasharray="4 3"
          style={{stroke: '#6C5FC7'}}
        />
      </svg>
      <ViewHandle
        onMouseDown={onMouseDown}
        isDragging={isDragging}
        style={{
          height: '20px',
        }}
      />
    </ViewHandleContainer>
  );
};

export default Minimap;
