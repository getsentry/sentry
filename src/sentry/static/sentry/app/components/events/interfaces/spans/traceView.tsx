import React from 'react';
import get from 'lodash/get';
import set from 'lodash/set';
import isNumber from 'lodash/isNumber';

import {t} from 'app/locale';
import EmptyStateWarning from 'app/components/emptyStateWarning';

import DragManager, {DragManagerChildrenProps} from './dragManager';
import SpanTree from './spanTree';
import {SpanType, SpanEntry, SentryTransactionEvent, ParsedTraceType} from './types';
import {isValidSpanID} from './utils';
import TraceViewHeader from './header';
import * as CursorGuideHandler from './cursorGuideHandler';

type TraceContextType = {
  op?: string;
  type?: 'trace';
  span_id?: string;
  trace_id?: string;
  parent_span_id?: string;
};

type PropType = {
  event: Readonly<SentryTransactionEvent>;
};

class TraceView extends React.Component<PropType> {
  minimapInteractiveRef = React.createRef<HTMLDivElement>();

  renderHeader = (dragProps: DragManagerChildrenProps, parsedTrace: ParsedTraceType) => {
    return (
      <TraceViewHeader
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
    const rootSpanOpName = (traceContext && traceContext.op) || 'transaction';

    if (!spanEntry || spans.length <= 0) {
      return {
        op: rootSpanOpName,
        childSpans: {},
        traceStartTimestamp: event.startTimestamp,
        traceEndTimestamp: event.endTimestamp,
        traceID,
        rootSpanID,
        numOfSpans: 0,
      };
    }

    // we reduce spans to become an object mapping span ids to their children

    const init: ParsedTraceType = {
      op: rootSpanOpName,
      childSpans: {},
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

      const spanChildren: Array<SpanType> = get(acc.childSpans, span.parent_span_id!, []);

      spanChildren.push(span);

      set(acc.childSpans, span.parent_span_id!, spanChildren);

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

    Object.values(reduced.childSpans).forEach(spanChildren => {
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
            <CursorGuideHandler.Provider
              interactiveLayerRef={this.minimapInteractiveRef}
              dragProps={dragProps}
              trace={parsedTrace}
            >
              {this.renderHeader(dragProps, parsedTrace)}
              <SpanTree trace={parsedTrace} dragProps={dragProps} />
            </CursorGuideHandler.Provider>
          );
        }}
      </DragManager>
    );
  }
}

export default TraceView;
