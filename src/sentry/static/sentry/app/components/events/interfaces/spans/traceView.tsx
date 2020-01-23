import React from 'react';
import get from 'lodash/get';
import set from 'lodash/set';
import pick from 'lodash/pick';
import isNumber from 'lodash/isNumber';

import {t} from 'app/locale';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import {createFuzzySearch} from 'app/utils/createFuzzySearch';
import EventView from 'app/views/eventsV2/eventView';

import DragManager, {DragManagerChildrenProps} from './dragManager';
import SpanTree from './spanTree';
import {RawSpanType, SpanEntry, SentryTransactionEvent, ParsedTraceType} from './types';
import {isValidSpanID, generateRootSpan, getSpanID, getSpanParentSpanID} from './utils';
import TraceViewHeader from './header';
import * as CursorGuideHandler from './cursorGuideHandler';

export type TraceContextType = {
  op?: string;
  type?: 'trace';
  span_id?: string;
  trace_id?: string;
  parent_span_id?: string;
};

type IndexedFusedSpan = {
  span: RawSpanType;
  indexed: string[];
  tagKeys: string[];
  tagValues: string[];
  dataKeys: string[];
  dataValues: string[];
};

type FuseResult = {
  item: IndexedFusedSpan;
  score: number;
};

export type FilterSpans = {
  results: FuseResult[];
  spanIDs: Set<string>;
};

type Props = {
  orgId: string;
  event: Readonly<SentryTransactionEvent>;
  searchQuery: string | undefined;
  eventView: EventView;
};

type State = {
  parsedTrace: ParsedTraceType;
  filterSpans: FilterSpans | undefined;
};

class TraceView extends React.PureComponent<Props, State> {
  minimapInteractiveRef = React.createRef<HTMLDivElement>();

  constructor(props: Props) {
    super(props);

    this.state = {
      parsedTrace: parseTrace(props.event),
      filterSpans: undefined,
    };

    this.filterOnSpans(props.searchQuery);
  }

  static getDerivedStateFromProps(props: Props, state: State): State {
    return {
      ...state,
      parsedTrace: parseTrace(props.event),
    };
  }

  componentDidUpdate(prevProps) {
    if (prevProps.searchQuery !== this.props.searchQuery) {
      this.filterOnSpans(this.props.searchQuery);
    }
  }

  async filterOnSpans(searchQuery: string | undefined) {
    if (!searchQuery) {
      // reset
      if (this.state.filterSpans !== undefined) {
        this.setState({
          filterSpans: undefined,
        });
      }
      return;
    }

    const {parsedTrace} = this.state;

    const {spans} = parsedTrace;

    const transformed: IndexedFusedSpan[] = [generateRootSpan(parsedTrace), ...spans].map(
      (span): IndexedFusedSpan => {
        const indexed: string[] = [];

        // basic properties

        const pickedSpan = pick(span, [
          // TODO: do we want this?
          // 'trace_id',
          'span_id',
          'start_timestamp',
          'timestamp',
          'op',
          'description',
        ]);

        const basicValues: string[] = Object.values(pickedSpan)
          .filter(value => {
            return !!value;
          })
          .map(value => {
            return String(value);
          });

        indexed.push(...basicValues);

        // tags

        let tagKeys: string[] = [];
        let tagValues: string[] = [];
        const tags: {[tag_name: string]: string} | undefined = get(span, 'tags');

        if (tags) {
          tagKeys = Object.keys(tags);
          tagValues = Object.values(tags);
        }

        const data: {[data_name: string]: any} | undefined = get(span, 'data', {});

        let dataKeys: string[] = [];
        let dataValues: string[] = [];
        if (data) {
          dataKeys = Object.keys(data);
          dataValues = Object.values(data).map(value => {
            return JSON.stringify(value, null, 4) || '';
          });
        }

        return {
          span,
          indexed,
          tagKeys,
          tagValues,
          dataKeys,
          dataValues,
        };
      }
    );

    const fuse = await createFuzzySearch(transformed, {
      keys: ['indexed', 'tagKeys', 'tagValues', 'dataKeys', 'dataValues'],
      includeMatches: false,
      threshold: 0.6,
      location: 0,
      distance: 100,
      maxPatternLength: 32,
    });

    const results = fuse.search<FuseResult>(searchQuery);

    const spanIDs: Set<string> = results.reduce((setOfSpanIDs: Set<string>, result) => {
      const spanID = getSpanID(result.item.span);

      if (spanID) {
        setOfSpanIDs.add(spanID);
      }

      return setOfSpanIDs;
    }, new Set<string>());

    this.setState({
      filterSpans: {
        results,
        spanIDs,
      },
    });
  }

  renderHeader = (dragProps: DragManagerChildrenProps, parsedTrace: ParsedTraceType) => {
    return (
      <TraceViewHeader
        minimapInteractiveRef={this.minimapInteractiveRef}
        dragProps={dragProps}
        trace={parsedTrace}
      />
    );
  };

  render() {
    const {event} = this.props;

    if (!getTraceContext(event)) {
      return (
        <EmptyStateWarning>
          <p>{t('There is no trace for this transaction')}</p>
        </EmptyStateWarning>
      );
    }

    const parsedTrace = this.state.parsedTrace;
    const {orgId, eventView} = this.props;

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
              <SpanTree
                eventView={eventView}
                trace={parsedTrace}
                dragProps={dragProps}
                filterSpans={this.state.filterSpans}
                orgId={orgId}
              />
            </CursorGuideHandler.Provider>
          );
        }}
      </DragManager>
    );
  }
}

function getTraceContext(
  event: Readonly<SentryTransactionEvent>
): TraceContextType | undefined {
  const traceContext: TraceContextType | undefined = get(event, 'contexts.trace');

  return traceContext;
}

function parseTrace(event: Readonly<SentryTransactionEvent>): ParsedTraceType {
  const spanEntry: SpanEntry | undefined = event.entries.find(
    (entry: {type: string}) => entry.type === 'spans'
  );

  const spans: Array<RawSpanType> = get(spanEntry, 'data', []);

  const traceContext = getTraceContext(event);
  const traceID = (traceContext && traceContext.trace_id) || '';
  const rootSpanID = (traceContext && traceContext.span_id) || '';
  const rootSpanOpName = (traceContext && traceContext.op) || 'transaction';
  const parentSpanID = traceContext && traceContext.parent_span_id;

  if (!spanEntry || spans.length <= 0) {
    return {
      op: rootSpanOpName,
      childSpans: {},
      traceStartTimestamp: event.startTimestamp,
      traceEndTimestamp: event.endTimestamp,
      traceID,
      rootSpanID,
      parentSpanID,
      numOfSpans: 0,
      spans: [],
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
    parentSpanID,
    numOfSpans: spans.length,
    spans,
  };

  const reduced: ParsedTraceType = spans.reduce((acc, span) => {
    if (!isValidSpanID(getSpanParentSpanID(span))) {
      return acc;
    }

    const spanChildren: Array<RawSpanType> = get(
      acc.childSpans,
      span.parent_span_id!,
      []
    );

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
}

export default TraceView;
