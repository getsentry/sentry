import React from 'react';
import styled from 'react-emotion';

import space from 'app/styles/space';

import {
  rectOfContent,
  clamp,
  rectRelativeTo,
  rectOfElement,
  toPercent,
  getHumanDuration,
} from './utils';
import {DragManagerChildrenProps} from './dragManager';
import {ParsedTraceType, TickAlignment} from './types';

const MINIMAP_HEIGHT = 75;
const TIME_AXIS_HEIGHT = 30;

type MinimapProps = {
  traceViewRef: React.RefObject<HTMLDivElement>;
  minimapInteractiveRef: React.RefObject<HTMLDivElement>;
  dragProps: DragManagerChildrenProps;
  trace: ParsedTraceType;
};

type MinimapState = {
  showCursorGuide: boolean;
  mousePageX: number | undefined;
  startViewHandleX: number;
};

class Minimap extends React.Component<MinimapProps, MinimapState> {
  state: MinimapState = {
    showCursorGuide: false,
    mousePageX: void 0,
    startViewHandleX: 100,
  };

  minimapRef = React.createRef<HTMLCanvasElement>();

  componentDidMount() {
    this.drawMinimap();
  }

  drawMinimap = () => {
    const canvas = this.minimapRef.current;
    const traceViewDOM = this.props.traceViewRef.current;

    if (!canvas || !traceViewDOM) {
      return;
    }

    const canvasContext = canvas.getContext('2d');

    if (!canvasContext) {
      return;
    }

    const rootRect = rectOfContent(traceViewDOM);

    const scaleX = canvas.clientWidth / rootRect.width;
    const scaleY = canvas.clientHeight / rootRect.height;

    // https://www.html5rocks.com/en/tutorials/canvas/hidpi/
    // we consider the devicePixelRatio (dpr) factor so that the canvas looks decent on hidpi screens
    // such as retina macbooks
    const devicePixelRatio = window.devicePixelRatio || 1;

    const resizeCanvas = (width: number, height: number) => {
      // scale the canvas up by the dpr factor
      canvas.width = width * devicePixelRatio;
      canvas.height = height * devicePixelRatio;

      // scale the canvas down by the dpr factor thru CSS
      canvas.style.width = '100%';
      canvas.style.height = `${height}px`;
    };

    resizeCanvas(rootRect.width * scaleX, rootRect.height * scaleY);

    canvasContext.setTransform(1, 0, 0, 1, 0, 0);
    canvasContext.clearRect(0, 0, canvas.width, canvas.height);
    canvasContext.scale(scaleX, scaleY);

    // scale canvas operations by the dpr factor
    canvasContext.scale(devicePixelRatio, devicePixelRatio);

    const black = (pc: number) => `rgba(0,0,0,${pc / 100})`;
    const back = black(0);

    const drawRect = (
      rect: {x: number; y: number; width: number; height: number},
      colour: string
    ) => {
      if (colour) {
        canvasContext.beginPath();
        canvasContext.rect(rect.x, rect.y, rect.width, rect.height);
        canvasContext.fillStyle = colour;
        canvasContext.fill();
      }
    };

    // draw background

    drawRect(rectRelativeTo(rootRect, rootRect), back);

    // draw the spans

    Array.from(traceViewDOM.querySelectorAll<HTMLElement>('[data-span="true"]')).forEach(
      el => {
        const backgroundColor = window.getComputedStyle(el).backgroundColor || black(10);
        drawRect(rectRelativeTo(rectOfElement(el), rootRect), backgroundColor);
      }
    );
  };

  renderMinimapCursorGuide = () => {
    if (!this.state.showCursorGuide || !this.state.mousePageX) {
      return null;
    }

    const minimapCanvas = this.props.minimapInteractiveRef.current;

    if (!minimapCanvas) {
      return null;
    }

    const rect = rectOfContent(minimapCanvas);

    // clamp mouseLeft to be within [0, 100]
    const mouseLeft = clamp(
      ((this.state.mousePageX - rect.x) / rect.width) * 100,
      0,
      100
    );

    return (
      <line
        x1={`${mouseLeft}%`}
        x2={`${mouseLeft}%`}
        y1="0"
        y2={MINIMAP_HEIGHT}
        strokeWidth="1"
        strokeOpacity="0.7"
        style={{stroke: '#E03E2F'}}
      />
    );
  };

  renderViewHandles = ({
    isDragging,
    onLeftHandleDragStart,
    leftHandlePosition,
    viewWindowStart,
    onRightHandleDragStart,
    rightHandlePosition,
    viewWindowEnd,
  }: DragManagerChildrenProps) => {
    const leftHandleGhost = isDragging ? (
      <g>
        <line
          x1={toPercent(viewWindowStart)}
          x2={toPercent(viewWindowStart)}
          y1="0"
          y2={MINIMAP_HEIGHT - 20}
          strokeWidth="1"
          strokeDasharray="4 3"
          style={{stroke: '#6C5FC7'}}
          opacity="0.5"
        />
        <ViewHandle
          x={toPercent(viewWindowStart)}
          onMouseDown={onLeftHandleDragStart}
          isDragging={false}
          opacity="0.5"
        />
      </g>
    ) : null;

    const leftHandle = (
      <g>
        <line
          x1={toPercent(leftHandlePosition)}
          x2={toPercent(leftHandlePosition)}
          y1="0"
          y2={MINIMAP_HEIGHT - 20}
          strokeWidth="1"
          strokeDasharray="4 3"
          style={{stroke: '#6C5FC7'}}
        />
        <ViewHandle
          x={toPercent(leftHandlePosition)}
          onMouseDown={onLeftHandleDragStart}
          isDragging={isDragging}
        />
      </g>
    );

    const rightHandle = (
      <g>
        <line
          x1={toPercent(rightHandlePosition)}
          x2={toPercent(rightHandlePosition)}
          y1="0"
          y2={MINIMAP_HEIGHT - 20}
          strokeWidth="1"
          strokeDasharray="4 3"
          style={{stroke: '#6C5FC7'}}
        />
        <ViewHandle
          x={toPercent(rightHandlePosition)}
          onMouseDown={onRightHandleDragStart}
          isDragging={isDragging}
        />
      </g>
    );

    const rightHandleGhost = isDragging ? (
      <g>
        <line
          x1={toPercent(viewWindowEnd)}
          x2={toPercent(viewWindowEnd)}
          y1="0"
          y2={MINIMAP_HEIGHT - 20}
          strokeWidth="1"
          strokeDasharray="4 3"
          style={{stroke: '#6C5FC7'}}
          opacity="0.5"
        />
        <ViewHandle
          x={toPercent(viewWindowEnd)}
          onMouseDown={onLeftHandleDragStart}
          isDragging={false}
          opacity="0.5"
        />
      </g>
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
        <Fog x={0} y={0} height="100%" width={toPercent(dragProps.viewWindowStart)} />
        <Fog
          x={toPercent(dragProps.viewWindowEnd)}
          y={0}
          height="100%"
          width={toPercent(1 - dragProps.viewWindowEnd)}
        />
      </React.Fragment>
    );
  };

  renderDurationGuide = () => {
    if (!this.state.showCursorGuide || !this.state.mousePageX) {
      return null;
    }

    const minimapCanvas = this.props.minimapInteractiveRef.current;

    if (!minimapCanvas) {
      return null;
    }

    const rect = rectOfContent(minimapCanvas);

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
        <svg
          style={{
            position: 'relative',
            left: 0,
            top: 0,
            width: '100%',
            height: `${TIME_AXIS_HEIGHT}px`,
            overflow: 'visible',
          }}
        >
          {this.renderTimeAxisCursorGuide()}
        </svg>
        {this.renderDurationGuide()}
      </TimeAxis>
    );
  };

  renderTimeAxisCursorGuide = () => {
    if (!this.state.showCursorGuide || !this.state.mousePageX) {
      return null;
    }

    const minimapCanvas = this.props.minimapInteractiveRef.current;

    if (!minimapCanvas) {
      return null;
    }

    const rect = rectOfContent(minimapCanvas);

    // clamp mouseLeft to be within [0, 100]
    const mouseLeft = clamp(
      ((this.state.mousePageX - rect.x) / rect.width) * 100,
      0,
      100
    );

    return (
      <line
        x1={`${mouseLeft}%`}
        x2={`${mouseLeft}%`}
        y1="0"
        y2={TIME_AXIS_HEIGHT}
        strokeWidth="1"
        strokeOpacity="0.7"
        style={{stroke: '#E03E2F'}}
      />
    );
  };

  render() {
    return (
      <React.Fragment>
        <MinimapContainer>
          <MinimapBackground innerRef={this.minimapRef} />
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
            <InteractiveLayer style={{overflow: 'visible'}}>
              {this.renderFog(this.props.dragProps)}
              {this.renderMinimapCursorGuide()}
              {this.renderViewHandles(this.props.dragProps)}
            </InteractiveLayer>
            {this.renderTimeAxis()}
          </div>
        </MinimapContainer>
      </React.Fragment>
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
  position: relative;
  left: 0;
  border-bottom: 1px solid #d1cad8;

  height: ${MINIMAP_HEIGHT + TIME_AXIS_HEIGHT + 1}px;
`;

const MinimapBackground = styled('canvas')`
  height: ${MINIMAP_HEIGHT}px;
  width: 100%;
  position: absolute;
  top: 0;
  left: 0;
`;

const InteractiveLayer = styled('svg')`
  height: ${MINIMAP_HEIGHT}px;
  width: 100%;
  position: relative;
  left: 0;
`;

const ViewHandle = styled('rect')`
  fill: #6c5fc7;

  cursor: col-resize;

  height: 20px;

  ${({isDragging}: {isDragging: boolean}) => {
    if (isDragging) {
      return `
      width: 5px;
      transform: translate(-2.5px, ${MINIMAP_HEIGHT - 20}px);
      `;
    }

    return `
    width: 3px;
    transform: translate(-1.5px, ${MINIMAP_HEIGHT - 20}px);
    `;
  }};

  &:hover {
    width: 5px;
    transform: translate(-2.5px, ${MINIMAP_HEIGHT - 20}px);
  }
`;

const Fog = styled('rect')`
  fill: rgba(241, 245, 251, 0.5);
`;

export default Minimap;
