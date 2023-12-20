import isEqual from 'lodash/isEqual';
import pick from 'lodash/pick';
import {action, computed, makeObservable, observable} from 'mobx';

import {Client} from 'sentry/api';
import {AggregateEventTransaction, EventTransaction} from 'sentry/types/event';
import {createFuzzySearch, Fuse} from 'sentry/utils/fuzzySearch';
import {TraceInfo} from 'sentry/views/performance/traceDetails/types';

import {ActiveOperationFilter, noFilter, toggleAllFilters, toggleFilter} from './filter';
import SpanTreeModel from './spanTreeModel';
import {
  EnhancedProcessedSpanType,
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
  event: Readonly<EventTransaction | AggregateEventTransaction>;
  rootSpan: SpanTreeModel;
  parsedTrace: ParsedTraceType;
  fuse: Fuse<IndexedFusedSpan> | undefined = undefined;
  affectedSpanIds: string[] | undefined = undefined;
  isEmbeddedSpanTree: boolean;

  // readable/writable state
  operationNameFilters: ActiveOperationFilter = noFilter;
  filterSpans: FilterSpans | undefined = undefined;
  searchQuery: string | undefined = undefined;
  hiddenSpanSubTrees: Set<string>;
  traceBounds: Array<TraceBound>;
  focusedSpanIds: Set<string> | undefined = undefined;

  constructor(
    event: Readonly<EventTransaction | AggregateEventTransaction>,
    affectedSpanIds?: string[],
    focusedSpanIds?: string[],
    hiddenSpanSubTrees?: Set<string>
  ) {
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
    this.hiddenSpanSubTrees = hiddenSpanSubTrees ?? new Set();

    // When viewing the span waterfall from a Performance Issue, a set of span IDs may be provided

    this.affectedSpanIds = affectedSpanIds;

    if (affectedSpanIds || focusedSpanIds) {
      affectedSpanIds ??= [];
      focusedSpanIds ??= [];
      this.focusedSpanIds = new Set([...affectedSpanIds, ...focusedSpanIds]);
    }

    // If the set of span IDs is provided, this waterfall is for an embedded span tree
    this.isEmbeddedSpanTree = !!this.focusedSpanIds;

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

      // span sub-tree toggling
      hiddenSpanSubTrees: observable,
      toggleSpanSubTree: action,

      // trace bounds
      traceBounds: observable,
      addTraceBounds: action,
      removeTraceBounds: action,

      focusedSpanIds: observable,
      expandHiddenSpans: action,
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

  toggleSpanSubTree = (spanID: string) => {
    if (this.hiddenSpanSubTrees.has(spanID)) {
      this.hiddenSpanSubTrees.delete(spanID);
      return;
    }

    this.hiddenSpanSubTrees.add(spanID);
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
    traceInfo,
  }: {
    // in [0, 1]
    viewEnd: number;
    viewStart: number; // in [0, 1]
    traceInfo?: TraceInfo;
  }) => {
    const bounds = traceInfo
      ? {
          traceEndTimestamp: traceInfo.endTimestamp,
          traceStartTimestamp: traceInfo.startTimestamp,
        }
      : this.getTraceBounds();

    return boundsGenerator({
      ...bounds,
      viewStart,
      viewEnd,
    });
  };

  getWaterfall = ({
    viewStart,
    viewEnd,
    traceInfo,
  }: {
    // in [0, 1]
    viewEnd: number;
    viewStart: number; // in [0, 1]
    traceInfo?: TraceInfo;
  }) => {
    const generateBounds = this.generateBounds({
      viewStart,
      viewEnd,
      traceInfo,
    });

    return this.rootSpan.getSpansList({
      operationNameFilters: this.operationNameFilters,
      generateBounds,
      treeDepth: 0,
      directParent: null,
      isLastSibling: true,
      continuingTreeDepths: [],
      hiddenSpanSubTrees: this.hiddenSpanSubTrees,
      spanAncestors: new Set(),
      filterSpans: this.filterSpans,
      focusedSpanIds: this.focusedSpanIds,
      previousSiblingEndTimestamp: undefined,
      event: this.event,
      isOnlySibling: true,
      spanNestedGrouping: undefined,
      toggleNestedSpanGroup: undefined,
      isNestedSpanGroupExpanded: false,
      addTraceBounds: this.addTraceBounds,
      removeTraceBounds: this.removeTraceBounds,
    });
  };

  expandHiddenSpans = (spans: EnhancedProcessedSpanType[]) => {
    spans.forEach(span => {
      if (span.type !== 'filtered_out') {
        return;
      }

      this.focusedSpanIds?.add(span.span.span_id);
    });
  };
}

export default WaterfallModel;
