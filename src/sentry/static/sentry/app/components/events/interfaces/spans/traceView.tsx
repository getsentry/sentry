import React from 'react';
import pick from 'lodash/pick';

import EmptyStateWarning from 'app/components/emptyStateWarning';
import {t} from 'app/locale';
import {Organization, SentryTransactionEvent} from 'app/types';
import {createFuzzySearch} from 'app/utils/createFuzzySearch';
import {TableData} from 'app/utils/discover/discoverQuery';

import * as CursorGuideHandler from './cursorGuideHandler';
import * as DividerHandlerManager from './dividerHandlerManager';
import DragManager, {DragManagerChildrenProps} from './dragManager';
import {ActiveOperationFilter} from './filter';
import TraceViewHeader from './header';
import * as ScrollbarManager from './scrollbarManager';
import SpanTree from './spanTree';
import {ParsedTraceType, RawSpanType} from './types';
import {generateRootSpan, getSpanID, getTraceContext} from './utils';

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
  organization: Organization;
  event: Readonly<SentryTransactionEvent>;
  parsedTrace: ParsedTraceType;
  searchQuery: string | undefined;
  spansWithErrors: TableData | null | undefined;
  operationNameFilters: ActiveOperationFilter;
};

type State = {
  filterSpans: FilterSpans | undefined;
};

class TraceView extends React.PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      filterSpans: undefined,
    };

    this.filterOnSpans(props.searchQuery);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.searchQuery !== this.props.searchQuery) {
      this.filterOnSpans(this.props.searchQuery);
    }
  }

  traceViewRef = React.createRef<HTMLDivElement>();
  virtualScrollBarContainerRef = React.createRef<HTMLDivElement>();
  minimapInteractiveRef = React.createRef<HTMLDivElement>();

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

    const {parsedTrace} = this.props;

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
          .filter(value => !!value)
          .map(value => String(value));

        indexed.push(...basicValues);

        // tags

        let tagKeys: string[] = [];
        let tagValues: string[] = [];
        const tags: {[tag_name: string]: string} | undefined = span?.tags;

        if (tags) {
          tagKeys = Object.keys(tags);
          tagValues = Object.values(tags);
        }

        const data: {[data_name: string]: any} | undefined = span?.data ?? {};

        let dataKeys: string[] = [];
        let dataValues: string[] = [];
        if (data) {
          dataKeys = Object.keys(data);
          dataValues = Object.values(data).map(
            value => JSON.stringify(value, null, 4) || ''
          );
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

  renderHeader = (dragProps: DragManagerChildrenProps, parsedTrace: ParsedTraceType) => (
    <TraceViewHeader
      minimapInteractiveRef={this.minimapInteractiveRef}
      dragProps={dragProps}
      trace={parsedTrace}
      event={this.props.event}
      virtualScrollBarContainerRef={this.virtualScrollBarContainerRef}
    />
  );

  render() {
    const {event, parsedTrace} = this.props;

    if (!getTraceContext(event)) {
      return (
        <EmptyStateWarning>
          <p>{t('There is no trace for this transaction')}</p>
        </EmptyStateWarning>
      );
    }

    const {orgId, organization, spansWithErrors, operationNameFilters} = this.props;

    return (
      <DragManager interactiveLayerRef={this.minimapInteractiveRef}>
        {(dragProps: DragManagerChildrenProps) => (
          <CursorGuideHandler.Provider
            interactiveLayerRef={this.minimapInteractiveRef}
            dragProps={dragProps}
            trace={parsedTrace}
          >
            <DividerHandlerManager.Provider interactiveLayerRef={this.traceViewRef}>
              <DividerHandlerManager.Consumer>
                {dividerHandlerChildrenProps => {
                  return (
                    <ScrollbarManager.Provider
                      dividerPosition={dividerHandlerChildrenProps.dividerPosition}
                      interactiveLayerRef={this.virtualScrollBarContainerRef}
                      dragProps={dragProps}
                    >
                      {this.renderHeader(dragProps, parsedTrace)}
                      <SpanTree
                        traceViewRef={this.traceViewRef}
                        event={event}
                        trace={parsedTrace}
                        dragProps={dragProps}
                        filterSpans={this.state.filterSpans}
                        orgId={orgId}
                        organization={organization}
                        spansWithErrors={spansWithErrors}
                        operationNameFilters={operationNameFilters}
                      />
                    </ScrollbarManager.Provider>
                  );
                }}
              </DividerHandlerManager.Consumer>
            </DividerHandlerManager.Provider>
          </CursorGuideHandler.Provider>
        )}
      </DragManager>
    );
  }
}

export default TraceView;
