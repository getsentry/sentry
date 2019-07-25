import React from 'react';
import styled from 'react-emotion';
import {get} from 'lodash';

import space from 'app/styles/space';
import Count from 'app/components/count';

import {SpanType, SpanChildrenLookupType, ParsedTraceType} from './types';
import {
  toPercent,
  boundsGenerator,
  SpanBoundsType,
  SpanGeneratedBoundsType,
  getHumanDuration,
} from './utils';
import {DragManagerChildrenProps} from './dragManager';
import SpanDetail from './spanDetail';

type RenderedSpanTree = {
  spanTree: JSX.Element | null;
  numOfHiddenSpansAbove: number;
};

type SpanTreeProps = {
  traceViewRef: React.RefObject<HTMLDivElement>;
  trace: ParsedTraceType;
  dragProps: DragManagerChildrenProps;
};

class SpanTree extends React.Component<SpanTreeProps> {
  renderSpan = ({
    treeDepth,
    numOfHiddenSpansAbove,
    spanID,
    traceID,
    lookup,
    span,
    generateBounds,
    pickSpanBarColour,
  }: {
    treeDepth: number;
    numOfHiddenSpansAbove: number;
    spanID: string;
    traceID: string;
    span: Readonly<SpanType>;
    lookup: Readonly<SpanChildrenLookupType>;
    generateBounds: (bounds: SpanBoundsType) => SpanGeneratedBoundsType;
    pickSpanBarColour: () => string;
  }): RenderedSpanTree => {
    const spanBarColour: string = pickSpanBarColour();

    const spanChildren: Array<SpanType> = get(lookup, spanID, []);

    const bounds = generateBounds({
      startTimestamp: span.start_timestamp,
      endTimestamp: span.timestamp,
    });

    const isCurrentSpanHidden = bounds.end <= 0 || bounds.start >= 1;

    type AccType = {
      renderedSpanChildren: Array<JSX.Element>;
      numOfHiddenSpansAbove: number;
    };

    const reduced: AccType = spanChildren.reduce(
      (acc: AccType, spanChild) => {
        const key = `${traceID}${spanChild.span_id}`;

        const results = this.renderSpan({
          treeDepth: treeDepth + 1,
          numOfHiddenSpansAbove: acc.numOfHiddenSpansAbove,
          span: spanChild,
          spanID: spanChild.span_id,
          traceID,
          lookup,
          generateBounds,
          pickSpanBarColour,
        });

        acc.renderedSpanChildren.push(
          <React.Fragment key={key}>{results.spanTree}</React.Fragment>
        );

        acc.numOfHiddenSpansAbove = results.numOfHiddenSpansAbove;

        return acc;
      },
      {
        renderedSpanChildren: [],
        numOfHiddenSpansAbove: isCurrentSpanHidden ? numOfHiddenSpansAbove + 1 : 0,
      }
    );

    const showHiddenSpansMessage = !isCurrentSpanHidden && numOfHiddenSpansAbove > 0;

    const hiddenSpansMessage = showHiddenSpansMessage ? (
      <SpanRowMessage>
        <span>Number of hidden spans: {numOfHiddenSpansAbove}</span>
      </SpanRowMessage>
    ) : null;

    return {
      numOfHiddenSpansAbove: reduced.numOfHiddenSpansAbove,
      spanTree: (
        <React.Fragment>
          {hiddenSpansMessage}
          <Span
            span={span}
            generateBounds={generateBounds}
            treeDepth={treeDepth}
            numOfSpanChildren={spanChildren.length}
            renderedSpanChildren={reduced.renderedSpanChildren}
            spanBarColour={spanBarColour}
          />
        </React.Fragment>
      ),
    };
  };

  renderRootSpan = (): RenderedSpanTree => {
    const {dragProps, trace} = this.props;

    // TODO: ideally this should be provided
    const rootSpan: SpanType = {
      trace_id: trace.traceID,
      parent_span_id: void 0,
      span_id: trace.rootSpanID,
      start_timestamp: trace.traceStartTimestamp,
      timestamp: trace.traceEndTimestamp,
      same_process_as_parent: true,
      op: 'transaction',
      data: {},
    };

    const COLORS = ['#e9e7f7', '#fcefde', '#fffbee', '#f1f5fb'];
    let current_index = 0;

    const pickSpanBarColour = () => {
      const next_colour = COLORS[current_index];

      current_index++;
      current_index = current_index % COLORS.length;

      return next_colour;
    };

    const generateBounds = boundsGenerator({
      traceStartTimestamp: trace.traceStartTimestamp,
      traceEndTimestamp: trace.traceEndTimestamp,
      viewStart: dragProps.viewWindowStart,
      viewEnd: dragProps.viewWindowEnd,
    });

    return this.renderSpan({
      treeDepth: 0,
      numOfHiddenSpansAbove: 0,
      span: rootSpan,
      spanID: rootSpan.span_id,
      traceID: rootSpan.trace_id,
      lookup: trace.lookup,
      generateBounds,
      pickSpanBarColour,
    });
  };

  render() {
    const {spanTree, numOfHiddenSpansAbove} = this.renderRootSpan();

    const hiddenSpansMessage =
      numOfHiddenSpansAbove > 0 ? (
        <SpanRowMessage>
          <span>Number of hidden spans: {numOfHiddenSpansAbove}</span>
        </SpanRowMessage>
      ) : null;

    return (
      <TraceViewContainer innerRef={this.props.traceViewRef}>
        {spanTree}
        {hiddenSpansMessage}
      </TraceViewContainer>
    );
  }
}

type SpanPropTypes = {
  span: Readonly<SpanType>;
  generateBounds: (bounds: SpanBoundsType) => SpanGeneratedBoundsType;
  treeDepth: number;
  numOfSpanChildren: number;
  renderedSpanChildren: Array<JSX.Element>;
  spanBarColour: string;
};

type SpanState = {
  displayDetail: boolean;
  showSpanTree: boolean;
};

class Span extends React.Component<SpanPropTypes, SpanState> {
  state: SpanState = {
    displayDetail: false,
    showSpanTree: true,
  };

  toggleSpanTree = () => {
    this.setState(state => {
      return {
        showSpanTree: !state.showSpanTree,
      };
    });
  };

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

    const chevron = this.state.showSpanTree ? <ChevronOpen /> : <ChevronClosed />;

    if (numOfSpanChildren <= 0) {
      return null;
    }

    return (
      <SpanTreeTogglerContainer style={{left: `${left}px`}}>
        <SpanTreeToggler
          onClick={event => {
            event.stopPropagation();

            this.toggleSpanTree();
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
          data-component="span-bar-title"
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

  renderSpanChildren = () => {
    if (!this.state.showSpanTree) {
      return null;
    }

    return this.props.renderedSpanChildren;
  };

  render() {
    const {span, spanBarColour} = this.props;

    const startTimestamp: number = span.start_timestamp;
    const endTimestamp: number = span.timestamp;

    const duration = Math.abs(endTimestamp - startTimestamp);
    const durationString = getHumanDuration(duration);

    const bounds = this.getBounds();

    const isVisible = bounds.end > 0 && bounds.start < 1;

    return (
      <React.Fragment>
        <SpanRow
          data-span-hidden={isVisible ? 'false' : 'true'}
          style={{
            display: isVisible ? 'block' : 'none',
            boxShadow: this.state.displayDetail ? '0 -1px 0 #d1cad8' : void 0,
          }}
          onClick={() => {
            this.toggleDisplayDetail();
          }}
        >
          <SpanBar
            data-span="true"
            style={{
              backgroundColor: spanBarColour,
              left: toPercent(bounds.start),
              width: toPercent(bounds.end - bounds.start),
            }}
          />
          {this.renderTitle()}
          <Duration>{durationString}</Duration>
          {this.renderDetail({isVisible})}
        </SpanRow>
        {this.renderSpanChildren()}
      </React.Fragment>
    );
  }
}

const TraceViewContainer = styled('div')`
  overflow-x: hidden;
  border-bottom-left-radius: 3px;
  border-bottom-right-radius: 3px;
`;

const SPAN_ROW_HEIGHT = 25;

const SpanRow = styled('div')`
  position: relative;
  overflow: hidden;

  cursor: pointer;
  transition: background-color 0.15s ease-in-out;

  &:last-child {
    & > [data-component='span-detail'] {
      border-bottom: none !important;
    }
  }

  &:hover {
    background-color: rgba(189, 180, 199, 0.1);

    & > [data-span='true'] {
      transition: border-color 0.15s ease-in-out;
      border: 1px solid rgba(0, 0, 0, 0.1);
    }
  }
`;

const SpanRowMessage = styled(SpanRow)`
  cursor: auto;

  color: #4a3e56;
  font-size: 12px;
  line-height: ${SPAN_ROW_HEIGHT}px;

  padding-left: ${space(1)};
  padding-right: ${space(1)};

  background-color: #f1f5fb !important;

  outline: 1px solid #c9d4ea;

  z-index: 99999;
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
`;

const SpanTreeTogglerContainer = styled('div')`
  position: relative;
  top: 0;

  height: 15px;

  max-width: 40px;
  width: 40px;
  min-width: 40px;

  margin-right: 8px;

  z-index: 999999;

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

  border-radius: 99px;
  border: 1px solid #6e5f7d;

  background: #fbfaf9;
  transition: all 0.15s ease-in-out;

  font-size: 9px;
  line-height: 0;
  color: #6e5f7d;

  &:hover {
    background: #6e5f7d;
    border: 1px solid #452650;
    color: #ffffff;

    & svg path {
      stroke: #fff;
    }
  }
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

export default SpanTree;
