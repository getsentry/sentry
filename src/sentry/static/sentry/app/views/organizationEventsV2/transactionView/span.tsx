import React from 'react';
import styled from 'react-emotion';
import {get} from 'lodash';
import 'intersection-observer'; // this is a polyfill

import {t} from 'app/locale';
import space from 'app/styles/space';
import Count from 'app/components/count';
import Tooltip from 'app/components/tooltip';

import {SPAN_ROW_HEIGHT, SpanRow} from './styles';
import {
  MINIMAP_CONTAINER_HEIGHT,
  MINIMAP_SPAN_BAR_HEIGHT,
  NUM_OF_SPANS_FIT_IN_MINI_MAP,
} from './minimap';

import {
  toPercent,
  SpanBoundsType,
  SpanGeneratedBoundsType,
  getHumanDuration,
  parseSpanTimestamps,
  TimestampStatus,
} from './utils';
import {SpanType, ParsedTraceType} from './types';
import {DividerHandlerManagerChildrenProps} from './dividerHandlerManager';
import * as DividerHandlerManager from './dividerHandlerManager';
import SpanDetail from './spanDetail';

type PropType = {
  span: Readonly<SpanType>;
  trace: Readonly<ParsedTraceType>;
  generateBounds: (bounds: SpanBoundsType) => SpanGeneratedBoundsType;
  treeDepth: number;
  numOfSpanChildren: number;
  renderedSpanChildren: Array<JSX.Element>;
  spanBarColour: string;
  spanNumber: number;
};

type State = {
  showSpanTree: boolean;
};

const INTERSECTION_THRESHOLDS: Array<number> = [];

// TODO: hardcode this or use babel macros
for (let i = 0; i <= 1.0; i += 0.01) {
  INTERSECTION_THRESHOLDS.push(i);
}

class Span extends React.Component<PropType, State> {
  state: State = {
    showSpanTree: true,
  };

  toggleSpanTree = () => {
    this.setState(state => {
      return {
        showSpanTree: !state.showSpanTree,
      };
    });
  };

  renderSpanChildren = () => {
    if (!this.state.showSpanTree) {
      return null;
    }

    return this.props.renderedSpanChildren;
  };

  render() {
    const {
      spanBarColour,
      span,
      numOfSpanChildren,
      trace,
      generateBounds,
      treeDepth,
      spanNumber,
    } = this.props;

    return (
      <React.Fragment>
        <FooSpanBar
          spanBarColour={spanBarColour}
          span={span}
          showSpanTree={this.state.showSpanTree}
          numOfSpanChildren={numOfSpanChildren}
          trace={trace}
          generateBounds={generateBounds}
          toggleSpanTree={this.toggleSpanTree}
          treeDepth={treeDepth}
          spanNumber={spanNumber}
        />
        {this.renderSpanChildren()}
      </React.Fragment>
    );
  }
}

const SpanRowCellContainer = styled('div')`
  position: relative;
  height: ${SPAN_ROW_HEIGHT}px;
`;

const SpanRowCell = styled('div')`
  position: absolute;

  height: ${SPAN_ROW_HEIGHT}px;

  overflow: hidden;
`;

export const DividerLine = styled('div')`
  position: absolute;
  height: ${SPAN_ROW_HEIGHT}px;

  transform: translateX(-50%);

  background-color: #cdc7d5;
  z-index: 999999;

  &.hovering {
    width: 4px !important;
    cursor: col-resize;
  }

  ${({hovering}: {hovering: boolean}) => {
    if (!hovering) {
      return `width: 2px;`;
    }

    return `
      width: 4px;
      cursor: col-resize;
      `;
  }};
`;

const SpanBarTitleContainer = styled('div')`
  display: flex;
  align-items: center;

  height: ${SPAN_ROW_HEIGHT}px;
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
`;

const SpanBarTitle = styled('div')`
  position: relative;
  top: 0;

  height: ${SPAN_ROW_HEIGHT}px;
  line-height: ${SPAN_ROW_HEIGHT}px;

  color: #4a3e56;
  font-size: 12px;

  user-select: none;

  white-space: nowrap;

  display: flex;
  align-items: center;
`;

const SpanTreeTogglerContainer = styled('div')`
  position: relative;
  top: 0;

  height: 15px;

  max-width: 40px;
  width: 40px;
  min-width: 40px;

  margin-right: 8px;

  z-index: 99999;

  user-select: none;

  display: flex;
  justify-content: flex-end;
`;

const SpanTreeToggler = styled('div')`
  position: relative;

  white-space: nowrap;

  height: 15px;
  min-width: 25px;

  padding-left: 4px;
  padding-right: 4px;

  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  align-content: center;
  justify-content: center;

  > span {
    flex-grow: 999;
  }

  transition: all 0.15s ease-in-out;

  border-radius: 99px;

  ${({isExpanded}: {isExpanded: boolean}) => {
    if (!isExpanded) {
      return `
      background: #6e5f7d;
      border: 1px solid #452650;
      color: #ffffff;
      & svg path {
        stroke: #ffffff;
      }

      &:hover {
        background: #fbfaf9;
        border: 1px solid #6e5f7d;
        color: #6e5f7d;
        & svg path {
          stroke: #452650;
        }
      }
      `;
    }

    return `
      background: #fbfaf9;
      border: 1px solid #6e5f7d;
      color: #6e5f7d;

      &:hover {
        background: #6e5f7d;
        border: 1px solid #452650;
        color: #ffffff;
        & svg path {
          stroke: #ffffff;
        }
      }
    `;
  }};

  font-size: 9px;
  line-height: 0;
`;

const Duration = styled('div')`
  position: absolute;
  right: 0;
  top: 0;
  height: ${SPAN_ROW_HEIGHT}px;
  line-height: ${SPAN_ROW_HEIGHT}px;

  color: #9585a3;
  font-size: 12px;
  padding-right: ${space(1)};

  user-select: none;
`;

const SpanBar = styled('div')`
  position: relative;
  min-height: ${SPAN_ROW_HEIGHT - 4}px;
  height: ${SPAN_ROW_HEIGHT - 4}px;
  max-height: ${SPAN_ROW_HEIGHT - 4}px;

  margin-top: 2px;
  margin-bottom: 2px;
  border-radius: 3px;

  overflow: hidden;

  user-select: none;

  padding: 4px;

  transition: border-color 0.15s ease-in-out;
  border: 1px solid rgba(0, 0, 0, 0);
`;

const ChevronOpen = props => (
  <svg width={5} height={4} fill="none" {...props}>
    <path
      d="M.5 1.25l2 2 2-2"
      stroke="#6E5F7D"
      strokeWidth={0.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ChevronClosed = props => (
  <svg width={3} height={6} fill="none" {...props}>
    <path
      d="M.5 5.25l2-2-2-2"
      stroke="#6E5F7D"
      strokeWidth={0.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const WarningIcon = props => (
  <svg width={15} height={15} fill="none" {...props}>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M7.012 4.463v3.825a.638.638 0 001.275 0V4.463a.637.637 0 10-1.275 0zM7.65 10.2a.637.637 0 100 1.275.637.637 0 000-1.275z"
      fill="#493A05"
    />
    <rect x={0.5} y={0.5} width={14} height={14} rx={7} stroke="#493A05" />
  </svg>
);

type FooSpanBarProps = {
  trace: Readonly<ParsedTraceType>;
  span: Readonly<SpanType>;
  spanBarColour: string;
  generateBounds: (bounds: SpanBoundsType) => SpanGeneratedBoundsType;
  treeDepth: number;
  showSpanTree: boolean;
  numOfSpanChildren: number;
  spanNumber: number;
  toggleSpanTree: () => void;
};

type FooSpanBarState = {
  displayDetail: boolean;
};

class FooSpanBar extends React.Component<FooSpanBarProps, FooSpanBarState> {
  state: FooSpanBarState = {
    displayDetail: false,
  };

  spanRowDOMRef = React.createRef<HTMLDivElement>();
  intersectionObserver?: IntersectionObserver = void 0;
  intersectionObserverVisibility?: IntersectionObserver = void 0;

  // TODO: remove this
  // resizeObserver?: any = void 0;

  toggleDisplayDetail = () => {
    this.setState(state => {
      return {
        displayDetail: !state.displayDetail,
      };
    });
  };

  renderDetail = ({isVisible}: {isVisible: boolean}) => {
    if (!this.state.displayDetail || !isVisible) {
      return null;
    }

    const {span} = this.props;

    return <SpanDetail span={span} />;
  };

  getBounds = () => {
    const {span, generateBounds} = this.props;

    return generateBounds({
      startTimestamp: span.start_timestamp,
      endTimestamp: span.timestamp,
    });
  };

  renderSpanTreeToggler = ({left}: {left: number}) => {
    const {numOfSpanChildren} = this.props;

    const chevron = this.props.showSpanTree ? <ChevronOpen /> : <ChevronClosed />;

    if (numOfSpanChildren <= 0) {
      return null;
    }

    return (
      <SpanTreeTogglerContainer style={{left: `${left}px`}}>
        <SpanTreeToggler
          isExpanded={this.props.showSpanTree}
          onClick={event => {
            event.stopPropagation();

            this.props.toggleSpanTree();
          }}
        >
          <span style={{marginRight: '2px', textAlign: 'center'}}>
            <Count value={numOfSpanChildren} />
          </span>
          <div style={{marginRight: '2px', width: '5px', textAlign: 'right'}}>
            {chevron}
          </div>
        </SpanTreeToggler>
      </SpanTreeTogglerContainer>
    );
  };

  renderTitle = ({warningText}: {warningText?: string} = {}) => {
    const {span, treeDepth} = this.props;

    const op = span.op ? <strong>{`${span.op} \u2014 `}</strong> : '';
    const description = get(span, 'description', span.span_id);

    const MARGIN_LEFT = 8;
    const TOGGLE_BUTTON_MARGIN_RIGHT = 8;
    const TOGGLE_BUTTON_MAX_WIDTH = 40;

    const left =
      treeDepth * (TOGGLE_BUTTON_MAX_WIDTH + TOGGLE_BUTTON_MARGIN_RIGHT) + MARGIN_LEFT;

    return (
      <SpanBarTitleContainer>
        {this.renderSpanTreeToggler({left})}
        <SpanBarTitle
          style={{
            left: `${left}px`,
            width: '100%',
          }}
        >
          <span>
            {op}
            {description}
          </span>
          {warningText && (
            <Tooltip title={warningText}>
              <span style={{marginLeft: '8px', lineHeight: 0, height: '15px'}}>
                <WarningIcon />
              </span>
            </Tooltip>
          )}
        </SpanBarTitle>
      </SpanBarTitleContainer>
    );
  };

  connectObservers = () => {
    if (!this.spanRowDOMRef.current) {
      return;
    }

    this.disconnectObservers();

    // track intersections events between the root span DOM element
    // and the viewport's intersection area. the intersection area is sized to
    // exclude the minimap

    this.intersectionObserver = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          const shouldMoveMinimap =
            this.props.trace.numOfSpans > NUM_OF_SPANS_FIT_IN_MINI_MAP;

          if (!shouldMoveMinimap) {
            return;
          }
          const spanNumber = this.props.spanNumber;

          const minimapSlider = document.getElementById('minimap-background-slider');

          if (!minimapSlider) {
            return;
          }

          // console.log('entry', entry, entry.target);

          // root refers to the root intersection rectangle used for the IntersectionObserver
          const rectRelativeToRoot = entry.boundingClientRect as DOMRect;

          const bottomYCoord = rectRelativeToRoot.y + rectRelativeToRoot.height;

          // refers to if the rect is out of view from the viewport
          const isOutOfViewAbove = rectRelativeToRoot.y < 0 && bottomYCoord < 0;

          if (isOutOfViewAbove) {
            return;
          }

          const relativeToMinimap = {
            top: rectRelativeToRoot.y - MINIMAP_CONTAINER_HEIGHT,
            bottom: bottomYCoord - MINIMAP_CONTAINER_HEIGHT,
          };

          const rectBelowMinimap =
            relativeToMinimap.top > 0 && relativeToMinimap.bottom > 0;

          if (rectBelowMinimap) {
            // if the first span is below the minimap, we scroll the minimap
            // to the top. this addresss spurious scrolling to the top of the page
            if (spanNumber <= 1) {
              minimapSlider.style.top = `0px`;
              return;
            }
            return;
          }

          const inAndAboveMinimap = relativeToMinimap.bottom <= 0;

          if (inAndAboveMinimap) {
            return;
          }

          // invariant: spanNumber >= 1

          const numberOfMovedSpans = spanNumber - 1;
          const totalHeightOfHiddenSpans = numberOfMovedSpans * MINIMAP_SPAN_BAR_HEIGHT;
          const currentSpanHiddenRatio = 1 - entry.intersectionRatio;

          const panYPixels =
            totalHeightOfHiddenSpans + currentSpanHiddenRatio * MINIMAP_SPAN_BAR_HEIGHT;

          // invariant: this.props.trace.numOfSpansend - spanNumberToStopMoving + 1 = NUM_OF_SPANS_FIT_IN_MINI_MAP

          const spanNumberToStopMoving =
            this.props.trace.numOfSpans + 1 - NUM_OF_SPANS_FIT_IN_MINI_MAP;

          if (spanNumber > spanNumberToStopMoving) {
            // if the last span bar appears on the minimap, we do not want the minimap
            // to keep panning upwards
            minimapSlider.style.top = `-${spanNumberToStopMoving *
              MINIMAP_SPAN_BAR_HEIGHT}px`;
            return;
          }

          minimapSlider.style.top = `-${panYPixels}px`;
        });
      },
      {
        threshold: INTERSECTION_THRESHOLDS,
        rootMargin: `-${MINIMAP_CONTAINER_HEIGHT}px 0px 0px 0px`,
      }
    );

    this.intersectionObserver.observe(this.spanRowDOMRef.current);

    // TODO: remove
    // this.intersectionObserverVisibility = new IntersectionObserver(
    //   entries => {
    //     entries.forEach(entry => {
    //       const isVisible = entry.intersectionRatio > 0;

    //       this.setState({
    //         shouldRenderSpanRow: isVisible,
    //       });
    //     });
    //   },
    //   {
    //     threshold: [0, 1],
    //     rootMargin: `100px 100px 100px 100px`,
    //   }
    // );

    // TODO: remove
    // this.intersectionObserverVisibility.observe(this.spanRowDOMRef.current);
  };

  disconnectObservers = () => {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }

    if (this.intersectionObserverVisibility) {
      this.intersectionObserverVisibility.disconnect();
    }
  };

  componentDidMount() {
    if (this.spanRowDOMRef.current) {
      this.connectObservers();

      // TODO: remove this
      // this.resizeObserver = new (window as any).ResizeObserver(() => {
      //   console.log('resized');
      //   this.connectObserver();
      // });

      // this.resizeObserver.observe(this.spanRowDOMRef.current);
    }
  }

  componentWillUnmount() {
    this.disconnectObservers();

    // TODO: remove this
    // if (this.resizeObserver) {
    //   this.resizeObserver.disconnect();
    // }
  }

  renderDivider = (dividerHandlerChildrenProps: DividerHandlerManagerChildrenProps) => {
    if (this.state.displayDetail) {
      // we would like to hide the divider lines when the span details
      // has been expanded
      return null;
    }

    const {dividerPosition} = dividerHandlerChildrenProps;

    // We display the ghost divider line for whenever the divider line is being dragged.
    // The ghost divider line indicates the original position of the divider line
    const ghostDivider = (
      <DividerLine
        data-test-id="divider-line-ghost"
        style={{
          left: toPercent(dividerPosition),
          display: 'none',
        }}
        hovering={true}
        onClick={event => {
          // the ghost divider line should not be interactive.
          // we prevent the propagation of the clicks from this component to prevent
          // the span detail from being opened.
          event.stopPropagation();
        }}
      />
    );

    return (
      <React.Fragment>
        {ghostDivider}
        <DividerLine
          data-test-id="divider-line"
          style={{
            left: toPercent(dividerPosition),
          }}
          hovering={false}
          onMouseEnter={() => {
            dividerHandlerChildrenProps.setHover(true);
          }}
          onMouseLeave={() => {
            dividerHandlerChildrenProps.setHover(false);
          }}
          onMouseOver={() => {
            dividerHandlerChildrenProps.setHover(true);
          }}
          onMouseDown={dividerHandlerChildrenProps.onDragStart}
          onClick={event => {
            // we prevent the propagation of the clicks from this component to prevent
            // the span detail from being opened.
            event.stopPropagation();
          }}
        />
      </React.Fragment>
    );
  };

  renderHeader = (dividerHandlerChildrenProps: DividerHandlerManagerChildrenProps) => {
    // TODO: remove
    // console.log('render span header');

    const {span, spanBarColour} = this.props;

    const startTimestamp: number = span.start_timestamp;
    const endTimestamp: number = span.timestamp;

    const duration = Math.abs(endTimestamp - startTimestamp);

    const durationString = getHumanDuration(duration);

    const timestampStatus = parseSpanTimestamps(span);

    const warningText =
      timestampStatus === TimestampStatus.Equal
        ? t('The start and end timestamps are equal')
        : timestampStatus === TimestampStatus.Reversed
        ? t('The start and end timestamps are reversed')
        : null;

    const bounds = this.getBounds();

    const spanLeft = timestampStatus === TimestampStatus.Stable ? bounds.start : 0;
    const spanWidth =
      timestampStatus === TimestampStatus.Stable ? bounds.end - bounds.start : 1;

    const {dividerPosition} = dividerHandlerChildrenProps;

    return (
      <SpanRowCellContainer>
        <SpanRowCell
          style={{
            left: 0,
            width: toPercent(dividerPosition),
            backgroundColor: this.state.displayDetail ? '#F0ECF3' : void 0,
          }}
        >
          {this.renderTitle({warningText})}
        </SpanRowCell>
        <SpanRowCell
          style={{
            left: toPercent(dividerPosition),
            width: toPercent(1 - dividerPosition),
            backgroundColor: this.state.displayDetail ? '#F0ECF3' : void 0,
          }}
        >
          <SpanBar
            style={{
              backgroundColor: spanBarColour,
              left: toPercent(spanLeft),
              width: toPercent(spanWidth),
            }}
          />
          <Duration>{durationString}</Duration>
        </SpanRowCell>
        {this.renderDivider(dividerHandlerChildrenProps)}
      </SpanRowCellContainer>
    );
  };

  render() {
    // TODO: remove
    // console.log('render span row');

    const {span} = this.props;

    const bounds = this.getBounds();

    const timestampStatus = parseSpanTimestamps(span);

    const isVisible =
      timestampStatus === TimestampStatus.Stable
        ? bounds.end > 0 && bounds.start < 1
        : true;

    return (
      <SpanRow
        innerRef={this.spanRowDOMRef}
        style={{
          display: isVisible ? 'block' : 'none',

          // TODO: this is a border-top; this needs polishing from a real CSS ninja
          boxShadow: this.state.displayDetail ? '0 -1px 0 #d1cad8' : void 0,
        }}
        onClick={() => {
          this.toggleDisplayDetail();
        }}
      >
        <DividerHandlerManager.Consumer>
          {(dividerHandlerChildrenProps: DividerHandlerManagerChildrenProps) => {
            return this.renderHeader(dividerHandlerChildrenProps);
          }}
        </DividerHandlerManager.Consumer>
        {this.renderDetail({isVisible})}
      </SpanRow>
    );
  }
}

export default Span;
