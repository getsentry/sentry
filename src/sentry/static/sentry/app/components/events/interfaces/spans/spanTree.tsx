import React from 'react';
import styled from 'react-emotion';
import {get, set, isNumber, forEach} from 'lodash';

import space from 'app/styles/space';
import Count from 'app/components/count';

import {SpanType, SpanEntry, SentryEvent} from './types';
import {
  isValidSpanID,
  toPercent,
  boundsGenerator,
  SpanBoundsType,
  SpanGeneratedBoundsType,
} from './utils';
import {DragManagerChildrenProps} from './dragManager';
import SpanDetail from './spanDetail';

type TraceContextType = {
  type: 'trace';
  span_id: string;
  trace_id: string;
};

type LookupType = {[span_id: string]: SpanType[]};

type RenderedSpanTree = {
  spanTree: JSX.Element;
  numOfHiddenSpansAbove: number;
};

type SpanTreeProps = {
  traceViewRef: React.RefObject<HTMLDivElement>;
  event: SentryEvent;
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
    lookup: Readonly<LookupType>;
    generateBounds: (bounds: SpanBoundsType) => SpanGeneratedBoundsType;
    pickSpanBarColour: () => string;
  }): RenderedSpanTree => {
    const spanBarColour: string = pickSpanBarColour();

    const spanChildren: SpanType[] = get(lookup, spanID, []);

    const start_timestamp: number = span.start_timestamp;
    const end_timestamp: number = span.timestamp;

    const bounds = generateBounds({
      startTimestamp: start_timestamp,
      endTimestamp: end_timestamp,
    });

    const isCurrentSpanHidden = bounds.end <= 0;

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

  renderRootSpan = (): JSX.Element | null => {
    const {event, dragProps} = this.props;

    const trace: TraceContextType | undefined = get(event, 'contexts.trace');

    if (!trace) {
      return null;
    }

    const parsedTrace = this.parseTrace();

    // TODO: ideally this should be provided
    const rootSpan: SpanType = {
      trace_id: trace.trace_id,
      parent_span_id: void 0,
      span_id: trace.span_id,
      start_timestamp: parsedTrace.traceStartTimestamp,
      timestamp: parsedTrace.traceEndTimestamp,
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

    // TODO: remove later
    // const traceEndTimestamp = _.isNumber(parsedTrace.traceEndTimestamp)
    //   ? parsedTrace.traceStartTimestamp == parsedTrace.traceEndTimestamp
    //     ? parsedTrace.traceStartTimestamp + 0.05
    //     : parsedTrace.traceEndTimestamp
    //   : parsedTrace.traceStartTimestamp + 0.05;

    const generateBounds = boundsGenerator({
      traceStartTimestamp: parsedTrace.traceStartTimestamp,
      traceEndTimestamp: parsedTrace.traceEndTimestamp,
      viewStart: dragProps.viewWindowStart,
      viewEnd: dragProps.viewWindowEnd,
    });

    return this.renderSpan({
      treeDepth: 0,
      numOfHiddenSpansAbove: 0,
      span: rootSpan,
      spanID: trace.span_id,
      traceID: trace.trace_id,
      lookup: parsedTrace.lookup,
      generateBounds,
      pickSpanBarColour,
    }).spanTree;
  };

  parseTrace = () => {
    const {event} = this.props;

    const spanEntry: SpanEntry | undefined = event.entries.find(
      (entry: {type: string}) => entry.type === 'spans'
    );

    const spans: SpanType[] = get(spanEntry, 'data', []);

    if (!spanEntry || spans.length <= 0) {
      return {
        lookup: {},
        traceStartTimestamp: 0,
        traceEndTimestamp: 0,
      };
    }

    // we reduce spans to become an object mapping span ids to their children

    type ReducedType = {
      lookup: LookupType;
      traceStartTimestamp: number;
      traceEndTimestamp: number;
    };

    const init: ReducedType = {
      lookup: {},
      traceStartTimestamp: spans[0].start_timestamp,
      traceEndTimestamp: 0,
    };

    const reduced: ReducedType = spans.reduce((acc, span) => {
      if (!isValidSpanID(span.parent_span_id)) {
        return acc;
      }

      const spanChildren: SpanType[] = get(acc.lookup, span.parent_span_id!, []);

      spanChildren.push(span);

      set(acc.lookup, span.parent_span_id!, spanChildren);

      if (!acc.traceStartTimestamp || span.start_timestamp < acc.traceStartTimestamp) {
        acc.traceStartTimestamp = span.start_timestamp;
      }

      // establish trace end timestamp

      const hasEndTimestamp = isNumber(span.timestamp);

      if (!acc.traceEndTimestamp) {
        if (hasEndTimestamp) {
          acc.traceEndTimestamp = span.timestamp;
          return acc;
        }

        acc.traceEndTimestamp = span.start_timestamp;
        return acc;
      }

      if (hasEndTimestamp && span.timestamp! > acc.traceEndTimestamp) {
        acc.traceEndTimestamp = span.timestamp;
        return acc;
      }

      if (span.start_timestamp > acc.traceEndTimestamp) {
        acc.traceEndTimestamp = span.start_timestamp;
      }

      return acc;
    }, init);

    // sort span children by their start timestamps in ascending order

    forEach(reduced.lookup, spanChildren => {
      spanChildren.sort((firstSpan, secondSpan) => {
        if (firstSpan.start_timestamp < secondSpan.start_timestamp) {
          return -1;
        }

        if (firstSpan.start_timestamp === secondSpan.start_timestamp) {
          return 0;
        }

        return 1;
      });
    });

    return reduced;
  };

  render() {
    return (
      <TraceViewContainer innerRef={this.props.traceViewRef}>
        {this.renderRootSpan()}
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

    const start_timestamp: number = span.start_timestamp;
    const end_timestamp: number = span.timestamp;

    return generateBounds({
      startTimestamp: start_timestamp,
      endTimestamp: end_timestamp,
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

    const start_timestamp: number = span.start_timestamp;
    const end_timestamp: number = span.timestamp;

    const duration = (end_timestamp - start_timestamp) * 1000;
    const durationString = `${duration.toFixed(3)} ms`;

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
