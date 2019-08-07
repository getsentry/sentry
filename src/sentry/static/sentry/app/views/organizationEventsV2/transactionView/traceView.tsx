import React from 'react';
import {get, set, isNumber, forEach} from 'lodash';

import {t} from 'app/locale';
import EmptyStateWarning from 'app/components/emptyStateWarning';

import DragManager, {DragManagerChildrenProps} from './dragManager';
import SpanTree from './spanTree';
import {SpanType, SpanEntry, SentryEvent, ParsedTraceType} from './types';
import {isValidSpanID} from './utils';
import TraceViewMinimap from './minimap';

type TraceContextType = {
  type: 'trace';
  span_id: string;
  trace_id: string;
};

type PropType = {
  event: Readonly<SentryEvent>;
};

type StateType = {
  renderMinimap: boolean;
};

class TraceView extends React.Component<PropType, StateType> {
  minimapInteractiveRef = React.createRef<HTMLDivElement>();
  traceViewRef = React.createRef<HTMLDivElement>();

  state: StateType = {
    renderMinimap: false,
  };

  componentDidMount() {
    if (this.traceViewRef.current) {
      // eslint-disable-next-line react/no-did-mount-set-state
      this.setState({
        renderMinimap: true,
      });
    }
  }

  renderMinimap = (dragProps: DragManagerChildrenProps, parsedTrace: ParsedTraceType) => {
    if (!this.state.renderMinimap) {
      return null;
    }

    return (
      <TraceViewMinimap
        traceViewRef={this.traceViewRef}
        minimapInteractiveRef={this.minimapInteractiveRef}
        dragProps={dragProps}
        trace={parsedTrace}
      />
    );
  };

  getTraceContext = () => {
    const {event} = this.props;

    const traceContext: TraceContextType | undefined = get(event, 'contexts.trace');

    return traceContext;
  };

  parseTrace = (): ParsedTraceType => {
    const {event} = this.props;

    const spanEntry: SpanEntry | undefined = event.entries.find(
      (entry: {type: string}) => entry.type === 'spans'
    );

    const spans: Array<SpanType> = get(spanEntry, 'data', []);

    const traceContext = this.getTraceContext();
    const traceID = (traceContext && traceContext.trace_id) || '';
    const rootSpanID = (traceContext && traceContext.span_id) || '';

    if (!spanEntry || spans.length <= 0) {
      return {
        lookup: {},
        traceStartTimestamp: event.startTimestamp,
        traceEndTimestamp: event.endTimestamp,
        traceID,
        rootSpanID,
        numOfSpans: 0,
      };
    }

    // we reduce spans to become an object mapping span ids to their children

    const init: ParsedTraceType = {
      lookup: {},
      traceStartTimestamp: event.startTimestamp,
      traceEndTimestamp: event.endTimestamp,
      traceID,
      rootSpanID,
      numOfSpans: spans.length,
    };

    const reduced: ParsedTraceType = spans.reduce((acc, span) => {
      if (!isValidSpanID(span.parent_span_id)) {
        return acc;
      }

      const spanChildren: Array<SpanType> = get(acc.lookup, span.parent_span_id!, []);

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
    if (!this.getTraceContext()) {
      return (
        <EmptyStateWarning>
          <p>{t('There is no trace for this transaction')}</p>
        </EmptyStateWarning>
      );
    }

    const parsedTrace = this.parseTrace();

    return (
      <DragManager interactiveLayerRef={this.minimapInteractiveRef}>
        {(dragProps: DragManagerChildrenProps) => {
          return (
            <React.Fragment>
              {this.renderMinimap(dragProps, parsedTrace)}
              <SpanTree
                traceViewRef={this.traceViewRef}
                trace={parsedTrace}
                dragProps={dragProps}
              />
            </React.Fragment>
          );
        }}
      </DragManager>
    );
  }
}

export default TraceView;
