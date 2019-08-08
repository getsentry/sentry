import React from 'react';
import styled from 'react-emotion';
import {get} from 'lodash';
import 'intersection-observer'; // this is a polyfill

import {t} from 'app/locale';
import space from 'app/styles/space';
import Count from 'app/components/count';
import Tooltip from 'app/components/tooltip';

import {
  toPercent,
  SpanBoundsType,
  SpanGeneratedBoundsType,
  getHumanDuration,
} from './utils';
import {SpanType, ParsedTraceType} from './types';
import {
  MINIMAP_CONTAINER_HEIGHT,
  MINIMAP_SPAN_BAR_HEIGHT,
  NUM_OF_SPANS_FIT_IN_MINI_MAP,
} from './minimap';
import {SPAN_ROW_HEIGHT, SpanRow, zIndex} from './styles';
import * as DividerHandlerManager from './dividerHandlerManager';
import SpanDetail from './spanDetail';

// TODO: maybe use babel-plugin-preval
// for (let i = 0; i <= 1.0; i += 0.01) {
//   INTERSECTION_THRESHOLDS.push(i);
// }
const INTERSECTION_THRESHOLDS: Array<number> = [
  0,
  0.01,
  0.02,
  0.03,
  0.04,
  0.05,
  0.06,
  0.07,
  0.08,
  0.09,
  0.1,
  0.11,
  0.12,
  0.13,
  0.14,
  0.15,
  0.16,
  0.17,
  0.18,
  0.19,
  0.2,
  0.21,
  0.22,
  0.23,
  0.24,
  0.25,
  0.26,
  0.27,
  0.28,
  0.29,
  0.3,
  0.31,
  0.32,
  0.33,
  0.34,
  0.35,
  0.36,
  0.37,
  0.38,
  0.39,
  0.4,
  0.41,
  0.42,
  0.43,
  0.44,
  0.45,
  0.46,
  0.47,
  0.48,
  0.49,
  0.5,
  0.51,
  0.52,
  0.53,
  0.54,
  0.55,
  0.56,
  0.57,
  0.58,
  0.59,
  0.6,
  0.61,
  0.62,
  0.63,
  0.64,
  0.65,
  0.66,
  0.67,
  0.68,
  0.69,
  0.7,
  0.71,
  0.72,
  0.73,
  0.74,
  0.75,
  0.76,
  0.77,
  0.78,
  0.79,
  0.8,
  0.81,
  0.82,
  0.83,
  0.84,
  0.85,
  0.86,
  0.87,
  0.88,
  0.89,
  0.9,
  0.91,
  0.92,
  0.93,
  0.94,
  0.95,
  0.96,
  0.97,
  0.98,
  0.99,
  1.0,
];

type SpanBarProps = {
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

type SpanBarState = {
  showDetail: boolean;
};

class SpanBar extends React.Component<SpanBarProps, SpanBarState> {
  state: SpanBarState = {
    showDetail: false,
  };

  spanRowDOMRef = React.createRef<HTMLDivElement>();
  intersectionObserver?: IntersectionObserver = void 0;
  zoomLevel: number = 1; // assume initial zoomLevel is 100%
  _mounted: boolean = false;

  toggleDisplayDetail = () => {
    this.setState(state => {
      return {
        showDetail: !state.showDetail,
      };
    });
  };

  renderDetail = ({isVisible}: {isVisible: boolean}) => {
    if (!this.state.showDetail || !isVisible) {
      return null;
    }

    const {span} = this.props;

    return <SpanDetail span={span} />;
  };

  getBounds = (): {
    warning: undefined | string;
    left: undefined | string;
    width: undefined | string;
    isSpanVisibleInView: boolean;
  } => {
    const {span, generateBounds} = this.props;

    const bounds = generateBounds({
      startTimestamp: span.start_timestamp,
      endTimestamp: span.timestamp,
    });

    switch (bounds.type) {
      case 'TRACE_TIMESTAMPS_EQUAL': {
        return {
          warning: t('Trace timestamps are equal'),
          left: void 0,
          width: void 0,
          isSpanVisibleInView: bounds.isSpanVisibleInView,
        };
      }
      case 'INVALID_VIEW_WINDOW': {
        return {
          warning: t('Invalid view window'),
          left: void 0,
          width: void 0,
          isSpanVisibleInView: bounds.isSpanVisibleInView,
        };
      }
      case 'TIMESTAMPS_EQUAL': {
        return {
          warning: t('The start and end timestamps are equal'),
          left: toPercent(bounds.start),
          width: `${bounds.width}px`,
          isSpanVisibleInView: bounds.isSpanVisibleInView,
        };
      }
      case 'TIMESTAMPS_REVERSED': {
        return {
          warning: t('The start and end timestamps are reversed'),
          left: toPercent(bounds.start),
          width: toPercent(bounds.end - bounds.start),
          isSpanVisibleInView: bounds.isSpanVisibleInView,
        };
      }
      case 'TIMESTAMPS_STABLE': {
        return {
          warning: void 0,
          left: toPercent(bounds.start),
          width: toPercent(bounds.end - bounds.start),
          isSpanVisibleInView: bounds.isSpanVisibleInView,
        };
      }
      default: {
        const _exhaustiveCheck: never = bounds;
        return _exhaustiveCheck;
      }
    }
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

  renderTitle = () => {
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
        </SpanBarTitle>
      </SpanBarTitleContainer>
    );
  };

  connectObservers = () => {
    if (!this.spanRowDOMRef.current) {
      return;
    }

    this.disconnectObservers();

    /**

    We track intersections events between the span bar's DOM element
    and the viewport's (root) intersection area. the intersection area is sized to
    exclude the minimap. See below.

    By default, the intersection observer's root intersection is the viewport.
    We adjust the margins of this root intersection area to exclude the minimap's
    height. The minimap's height is always fixed.

      VIEWPORT (ancestor element used for the intersection events)
    +--+-------------------------+--+
    |  |                         |  |
    |  |       MINIMAP           |  |
    |  |                         |  |
    |  +-------------------------+  |  ^
    |  |                         |  |  |
    |  |       SPANS             |  |  | ROOT
    |  |                         |  |  | INTERSECTION
    |  |                         |  |  | OBSERVER
    |  |                         |  |  | HEIGHT
    |  |                         |  |  |
    |  |                         |  |  |
    |  |                         |  |  |
    |  +-------------------------+  |  |
    |                               |  |
    +-------------------------------+  v

     */

    this.intersectionObserver = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (!this._mounted) {
            return;
          }

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

          // NOTE: THIS IS HACKY.
          //
          // IntersectionObserver.rootMargin is un-affected by the browser's zoom level.
          // The margins of the intersection area needs to be adjusted.
          // Thus, IntersectionObserverEntry.rootBounds may not be what we expect.
          //
          // We address this below.
          //
          // Note that this function was called whenever an intersection event occurred wrt
          // the thresholds.
          //
          if (entry.rootBounds) {
            // After we create the IntersectionObserver instance with rootMargin set as:
            // -${MINIMAP_CONTAINER_HEIGHT * this.zoomLevel}px 0px 0px 0px
            //
            // we can introspect the rootBounds to infer the zoomlevel.
            //
            // we always expect entry.rootBounds.top to equal MINIMAP_CONTAINER_HEIGHT

            const actualRootTop = Math.ceil(entry.rootBounds.top);

            if (actualRootTop !== MINIMAP_CONTAINER_HEIGHT && actualRootTop > 0) {
              // we revert the actualRootTop value by the current zoomLevel factor
              const normalizedActualTop = actualRootTop / this.zoomLevel;

              const zoomLevel = MINIMAP_CONTAINER_HEIGHT / normalizedActualTop;
              this.zoomLevel = zoomLevel;

              // we reconnect the observers; the callback functions may be invoked
              this.connectObservers();

              // NOTE: since we cannot guarantee that the callback function is invoked on
              //       the newly connected observers, we continue running this function.
            }
          }

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
              minimapSlider.style.top = '0px';
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
        rootMargin: `-${MINIMAP_CONTAINER_HEIGHT * this.zoomLevel}px 0px 0px 0px`,
      }
    );

    this.intersectionObserver.observe(this.spanRowDOMRef.current);
  };

  disconnectObservers = () => {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }
  };

  componentDidMount() {
    this._mounted = true;
    if (this.spanRowDOMRef.current) {
      this.connectObservers();
    }
  }

  componentWillUnmount() {
    this._mounted = false;
    this.disconnectObservers();
  }

  renderDivider = (
    dividerHandlerChildrenProps: DividerHandlerManager.DividerHandlerManagerChildrenProps
  ) => {
    if (this.state.showDetail) {
      // we would like to hide the divider lines when the span details
      // has been expanded
      return null;
    }

    const {
      dividerPosition,
      addDividerLineRef,
      addGhostDividerLineRef,
    } = dividerHandlerChildrenProps;

    // We display the ghost divider line for whenever the divider line is being dragged.
    // The ghost divider line indicates the original position of the divider line
    const ghostDivider = (
      <DividerLine
        innerRef={addGhostDividerLineRef()}
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
          innerRef={addDividerLineRef()}
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

  renderWarningText = ({warningText}: {warningText?: string} = {}) => {
    if (!warningText) {
      return null;
    }

    return (
      <WarningTextWrapper>
        <Tooltip title={warningText}>
          <span style={{marginLeft: '8px', lineHeight: 0, height: '15px'}}>
            <WarningIcon />
          </span>
        </Tooltip>
      </WarningTextWrapper>
    );
  };

  renderHeader = (
    dividerHandlerChildrenProps: DividerHandlerManager.DividerHandlerManagerChildrenProps
  ) => {
    const {span, spanBarColour} = this.props;

    const startTimestamp: number = span.start_timestamp;
    const endTimestamp: number = span.timestamp;

    const duration = Math.abs(endTimestamp - startTimestamp);

    const durationString = getHumanDuration(duration);

    const bounds = this.getBounds();

    const {dividerPosition} = dividerHandlerChildrenProps;

    const displaySpanBar = bounds.left && bounds.width;

    return (
      <SpanRowCellContainer>
        <SpanRowCell
          style={{
            left: 0,
            width: toPercent(dividerPosition),
            backgroundColor: this.state.showDetail ? '#F0ECF3' : void 0,
          }}
        >
          {this.renderTitle()}
        </SpanRowCell>
        <SpanRowCell
          style={{
            left: toPercent(dividerPosition),
            width: toPercent(1 - dividerPosition),
            backgroundColor: this.state.showDetail ? '#F0ECF3' : void 0,
          }}
        >
          {displaySpanBar && (
            <SpanBarRectangle
              style={{
                backgroundColor: spanBarColour,
                left: bounds.left,
                width: bounds.width,
              }}
            />
          )}
          <Duration>{durationString}</Duration>
          {this.renderWarningText({warningText: bounds.warning})}
        </SpanRowCell>
        {this.renderDivider(dividerHandlerChildrenProps)}
      </SpanRowCellContainer>
    );
  };

  render() {
    const bounds = this.getBounds();

    const isSpanVisibleInView = bounds.isSpanVisibleInView;

    return (
      <SpanRow
        innerRef={this.spanRowDOMRef}
        style={{
          display: isSpanVisibleInView ? 'block' : 'none',

          // TODO: this is a border-top; this needs polishing from a real CSS ninja
          boxShadow: this.state.showDetail ? '0 -1px 0 #d1cad8' : void 0,
        }}
        onClick={() => {
          this.toggleDisplayDetail();
        }}
      >
        <DividerHandlerManager.Consumer>
          {(
            dividerHandlerChildrenProps: DividerHandlerManager.DividerHandlerManagerChildrenProps
          ) => {
            return this.renderHeader(dividerHandlerChildrenProps);
          }}
        </DividerHandlerManager.Consumer>
        {this.renderDetail({isVisible: isSpanVisibleInView})}
      </SpanRow>
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
  z-index: ${zIndex.dividerLine};

  &.hovering {
    width: 4px !important;
    cursor: col-resize;
  }

  ${({hovering}: {hovering: boolean}) => {
    if (!hovering) {
      return 'width: 2px;';
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

  z-index: ${zIndex.spanTreeToggler};

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

const SpanBarRectangle = styled('div')`
  position: relative;
  min-height: ${SPAN_ROW_HEIGHT - 4}px;
  height: ${SPAN_ROW_HEIGHT - 4}px;
  max-height: ${SPAN_ROW_HEIGHT - 4}px;

  min-width: 1px;

  margin-top: 2px;
  margin-bottom: 2px;
  border-radius: 3px;

  overflow: hidden;

  user-select: none;

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

const WarningTextWrapper = styled('div')`
  height: ${SPAN_ROW_HEIGHT}px;

  position: absolute;
  left: 0;
  top: 0;

  display: flex;
  align-items: center;
`;

export default SpanBar;
