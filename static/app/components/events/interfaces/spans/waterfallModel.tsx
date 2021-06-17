import isEqual from 'lodash/isEqual';
import pick from 'lodash/pick';
import {action, computed, makeObservable, observable} from 'mobx';

import {EventTransaction} from 'app/types/event';
import {createFuzzySearch} from 'app/utils/createFuzzySearch';

import {ActiveOperationFilter, noFilter, toggleAllFilters, toggleFilter} from './filter';
import SpanTreeModel from './spanTreeModel';
import {
  FilterSpans,
  FuseResult,
  IndexedFusedSpan,
  ParsedTraceType,
  RawSpanType,
  SpanFuseOptions,
} from './types';
import {generateRootSpan, getSpanID, parseTrace} from './utils';

class WaterfallModel {
  // readonly state
  event: Readonly<EventTransaction>;
  rootSpan: SpanTreeModel;
  parsedTrace: ParsedTraceType;
  fuse: Fuse<string, SpanFuseOptions> | undefined = undefined;

  // readable/writable state
  operationNameFilters: ActiveOperationFilter = noFilter;
  filterSpans: FilterSpans | undefined = undefined;
  searchQuery: string | undefined = undefined;

  constructor(event: Readonly<EventTransaction>) {
    this.event = event;

    this.parsedTrace = parseTrace(event);
    const rootSpan = generateRootSpan(this.parsedTrace);
    this.rootSpan = new SpanTreeModel(rootSpan, this.parsedTrace.childSpans);

    this.indexSearch(this.parsedTrace, rootSpan);

    makeObservable(this, {
      rootSpan: observable,

      // operation names filtering
      operationNameFilters: observable,
      toggleOperationNameFilter: action,
      toggleAllOperationNameFilters: action,
      operationNameCounts: computed.struct,

      // span search
      filterSpans: observable,
      searchQuery: observable,
      querySpanSearch: action,
    });
  }

  isEvent(otherEvent: Readonly<EventTransaction>) {
    return isEqual(this.event, otherEvent);
  }

  toggleOperationNameFilter = (operationName: string) => {
    this.operationNameFilters = toggleFilter(this.operationNameFilters, operationName);
  };

  toggleAllOperationNameFilters = () => {
    const operationNames = Array.from(this.operationNameCounts.keys());

    this.operationNameFilters = toggleAllFilters(
      this.operationNameFilters,
      operationNames
    );
  };

  get operationNameCounts(): Map<string, number> {
    return this.rootSpan.operationNameCounts;
  }

  async indexSearch(parsedTrace: ParsedTraceType, rootSpan: RawSpanType) {
    this.filterSpans = undefined;
    this.searchQuery = undefined;

    const {spans} = parsedTrace;

    const transformed: IndexedFusedSpan[] = [rootSpan, ...spans].map(
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

    this.fuse = await createFuzzySearch(transformed, {
      keys: ['indexed', 'tagKeys', 'tagValues', 'dataKeys', 'dataValues'],
      includeMatches: false,
      threshold: 0.6,
      location: 0,
      distance: 100,
      maxPatternLength: 32,
    });
  }

  querySpanSearch(searchQuery: string | undefined) {
    if (!searchQuery) {
      // reset
      if (this.filterSpans !== undefined) {
        this.filterSpans = undefined;
        this.searchQuery = undefined;
      }
      return;
    }

    if (!this.fuse) {
      return;
    }

    const results = this.fuse.search<FuseResult>(searchQuery);

    const spanIDs: Set<string> = results.reduce((setOfSpanIDs: Set<string>, result) => {
      const spanID = getSpanID(result.item.span);

      if (spanID) {
        setOfSpanIDs.add(spanID);
      }

      return setOfSpanIDs;
    }, new Set<string>());

    this.searchQuery = searchQuery;
    this.filterSpans = {
      results,
      spanIDs,
    };
  }
}

export default WaterfallModel;
