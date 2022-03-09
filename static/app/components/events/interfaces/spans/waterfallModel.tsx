import isEqual from 'lodash/isEqual';
import pick from 'lodash/pick';
import {action, computed, makeObservable, observable} from 'mobx';

import {Client} from 'sentry/api';
import {EventTransaction} from 'sentry/types/event';
import {createFuzzySearch, Fuse} from 'sentry/utils/fuzzySearch';

import {ActiveOperationFilter, noFilter, toggleAllFilters, toggleFilter} from './filter';
import SpanTreeModel from './spanTreeModel';
import {
  FilterSpans,
  IndexedFusedSpan,
  ParsedTraceType,
  RawSpanType,
  TraceBound,
} from './types';
import {boundsGenerator, generateRootSpan, getSpanID, parseTrace} from './utils';

class WaterfallModel {
  api: Client = new Client();

  // readonly state
  event: Readonly<EventTransaction>;
  rootSpan: SpanTreeModel;
  parsedTrace: ParsedTraceType;
  fuse: Fuse<IndexedFusedSpan> | undefined = undefined;

  // readable/writable state
  operationNameFilters: ActiveOperationFilter = noFilter;
  filterSpans: FilterSpans | undefined = undefined;
  searchQuery: string | undefined = undefined;
  hiddenSpanGroups: Set<string>;
  traceBounds: Array<TraceBound>;

  constructor(event: Readonly<EventTransaction>) {
    this.event = event;

    this.parsedTrace = parseTrace(event);
    const rootSpan = generateRootSpan(this.parsedTrace);
    this.rootSpan = new SpanTreeModel(
      rootSpan,
      this.parsedTrace.childSpans,
      this.api,
      true
    );

    // Track the trace bounds of the current transaction and the trace bounds of
    // any embedded transactions
    this.traceBounds = [this.rootSpan.generateTraceBounds()];

    this.indexSearch(this.parsedTrace, rootSpan);

    // Set of span IDs whose sub-trees should be hidden. This is used for the
    // span tree toggling product feature.
    this.hiddenSpanGroups = new Set();

    makeObservable(this, {
      parsedTrace: observable,
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

      // span group toggling
      hiddenSpanGroups: observable,
      toggleSpanGroup: action,

      // trace bounds
      traceBounds: observable,
      addTraceBounds: action,
      removeTraceBounds: action,
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

    const results = this.fuse.search(searchQuery);

    const spanIDs: Set<string> = results.reduce((setOfSpanIDs: Set<string>, result) => {
      const spanID = getSpanID(result.item.span);

      if (spanID) {
        setOfSpanIDs.add(spanID);
      }

      return setOfSpanIDs;
    }, new Set<string>());

    this.searchQuery = searchQuery;
    this.filterSpans = {spanIDs, results};
  }

  toggleSpanGroup = (spanID: string) => {
    if (this.hiddenSpanGroups.has(spanID)) {
      this.hiddenSpanGroups.delete(spanID);
      return;
    }

    this.hiddenSpanGroups.add(spanID);
  };

  addTraceBounds = (traceBound: TraceBound) => {
    this.traceBounds.push(traceBound);

    this.parsedTrace = {
      ...this.parsedTrace,
      ...this.getTraceBounds(),
    };
  };

  removeTraceBounds = (spanId: string) => {
    this.traceBounds = this.traceBounds.filter(bound => bound.spanId !== spanId);

    // traceBounds must always be non-empty
    if (this.traceBounds.length === 0) {
      this.traceBounds = [this.rootSpan.generateTraceBounds()];
    }

    this.parsedTrace = {
      ...this.parsedTrace,
      ...this.getTraceBounds(),
    };
  };

  getTraceBounds = () => {
    // traceBounds must always be non-empty
    if (this.traceBounds.length === 0) {
      this.traceBounds = [this.rootSpan.generateTraceBounds()];
    }

    return this.traceBounds.reduce(
      (acc, bounds) => {
        return {
          traceStartTimestamp: Math.min(
            acc.traceStartTimestamp,
            bounds.traceStartTimestamp
          ),
          traceEndTimestamp: Math.max(acc.traceEndTimestamp, bounds.traceEndTimestamp),
        };
      },
      {
        traceStartTimestamp: this.traceBounds[0].traceStartTimestamp,
        traceEndTimestamp: this.traceBounds[0].traceEndTimestamp,
      }
    );
  };

  generateBounds = ({
    viewStart,
    viewEnd,
  }: {
    // in [0, 1]
    viewEnd: number;
    viewStart: number; // in [0, 1]
  }) => {
    return boundsGenerator({
      ...this.getTraceBounds(),
      viewStart,
      viewEnd,
    });
  };

  getWaterfall = ({
    viewStart,
    viewEnd,
  }: {
    // in [0, 1]
    viewEnd: number;
    viewStart: number; // in [0, 1]
  }) => {
    const generateBounds = this.generateBounds({
      viewStart,
      viewEnd,
    });

    return this.rootSpan.getSpansList({
      operationNameFilters: this.operationNameFilters,
      generateBounds,
      treeDepth: 0,
      isLastSibling: true,
      continuingTreeDepths: [],
      hiddenSpanGroups: this.hiddenSpanGroups,
      spanGroups: new Set(),
      filterSpans: this.filterSpans,
      previousSiblingEndTimestamp: undefined,
      event: this.event,
      isOnlySibling: true,
      spanGrouping: undefined,
      toggleSpanGroup: undefined,
      showSpanGroup: false,
      addTraceBounds: this.addTraceBounds,
      removeTraceBounds: this.removeTraceBounds,
    });
  };
}

export default WaterfallModel;
