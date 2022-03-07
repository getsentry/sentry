import {action, computed, makeObservable, observable} from 'mobx';

import {Client} from 'sentry/api';
import {t} from 'sentry/locale';
import {EventTransaction} from 'sentry/types/event';

import {ActiveOperationFilter} from './filter';
import {
  EnhancedProcessedSpanType,
  EnhancedSpan,
  FetchEmbeddedChildrenState,
  FilterSpans,
  OrphanTreeDepth,
  RawSpanType,
  SpanChildrenLookupType,
  SpanType,
  TraceBound,
  TreeDepthType,
} from './types';
import {
  generateRootSpan,
  getSpanID,
  getSpanOperation,
  isEventFromBrowserJavaScriptSDK,
  isOrphanSpan,
  parseTrace,
  SpanBoundsType,
  SpanGeneratedBoundsType,
} from './utils';

const MIN_SIBLING_GROUP_SIZE = 5;

class SpanTreeModel {
  api: Client;

  // readonly state
  span: Readonly<SpanType>;
  children: Array<SpanTreeModel> = [];
  isRoot: boolean;

  // readable/writable state
  fetchEmbeddedChildrenState: FetchEmbeddedChildrenState = 'idle';
  showEmbeddedChildren: boolean = false;
  embeddedChildren: Array<SpanTreeModel> = [];
  showSpanGroup: boolean = false;
  // Entries in this set will follow the format 'op.description'.
  // Entries will indicate whether a sibling group should be expanded or collapsed
  ungroupedSiblings: Set<string> = new Set();

  constructor(
    parentSpan: SpanType,
    childSpans: SpanChildrenLookupType,
    api: Client,
    isRoot: boolean = false
  ) {
    this.api = api;
    this.span = parentSpan;
    this.isRoot = isRoot;

    const spanID = getSpanID(parentSpan);
    const spanChildren: Array<RawSpanType> = childSpans?.[spanID] ?? [];

    // Mark descendents as being rendered. This is to address potential recursion issues due to malformed data.
    // For example if a span has a span_id that's identical to its parent_span_id.
    childSpans = {
      ...childSpans,
    };
    delete childSpans[spanID];

    this.children = spanChildren.map(span => {
      return new SpanTreeModel(span, childSpans, api);
    });

    makeObservable(this, {
      operationNameCounts: computed.struct,
      showEmbeddedChildren: observable,
      embeddedChildren: observable,
      fetchEmbeddedChildrenState: observable,
      toggleEmbeddedChildren: action,
      fetchEmbeddedTransactions: action,
      showSpanGroup: observable,
      toggleSpanGroup: action,
      ungroupedSiblings: observable,
      toggleSiblingSpanGroup: action,
    });
  }

  get operationNameCounts(): Map<string, number> {
    const result = new Map<string, number>();

    const operationName = this.span.op;

    if (typeof operationName === 'string' && operationName.length > 0) {
      result.set(operationName, 1);
    }

    for (const directChild of this.children) {
      const operationNameCounts = directChild.operationNameCounts;
      for (const [key, count] of operationNameCounts) {
        result.set(key, (result.get(key) ?? 0) + count);
      }
    }

    // sort alphabetically using case insensitive comparison
    return new Map(
      [...result].sort((a, b) =>
        String(a[0]).localeCompare(b[0], undefined, {sensitivity: 'base'})
      )
    );
  }

  isSpanFilteredOut = (props: {
    filterSpans: FilterSpans | undefined;
    operationNameFilters: ActiveOperationFilter;
  }): boolean => {
    const {operationNameFilters, filterSpans} = props;

    if (operationNameFilters.type === 'active_filter') {
      const operationName = getSpanOperation(this.span);

      if (
        typeof operationName === 'string' &&
        !operationNameFilters.operationNames.has(operationName)
      ) {
        return true;
      }
    }

    if (!filterSpans) {
      return false;
    }

    return !filterSpans.spanIDs.has(getSpanID(this.span));
  };

  generateSpanGap(
    event: Readonly<EventTransaction>,
    previousSiblingEndTimestamp: number | undefined,
    treeDepth: number,
    continuingTreeDepths: Array<TreeDepthType>
  ): EnhancedProcessedSpanType | undefined {
    // hide gap spans (i.e. "missing instrumentation" spans) for browser js transactions,
    // since they're not useful to indicate
    const shouldIncludeGap = !isEventFromBrowserJavaScriptSDK(event);

    const isValidGap =
      shouldIncludeGap &&
      typeof previousSiblingEndTimestamp === 'number' &&
      previousSiblingEndTimestamp < this.span.start_timestamp &&
      // gap is at least 100 ms
      this.span.start_timestamp - previousSiblingEndTimestamp >= 0.1;
    if (!isValidGap) {
      return undefined;
    }

    const gapSpan: EnhancedProcessedSpanType = {
      type: 'gap',
      span: {
        type: 'gap',
        start_timestamp: previousSiblingEndTimestamp || this.span.start_timestamp,
        timestamp: this.span.start_timestamp, // this is essentially end_timestamp
        description: t('Missing instrumentation'),
        isOrphan: isOrphanSpan(this.span),
      },
      numOfSpanChildren: 0,
      treeDepth,
      isLastSibling: false,
      continuingTreeDepths,
      fetchEmbeddedChildrenState: 'idle',
      showEmbeddedChildren: false,
      toggleEmbeddedChildren: undefined,
    };
    return gapSpan;
  }

  getSpansList = (props: {
    addTraceBounds: (bounds: TraceBound) => void;
    continuingTreeDepths: Array<TreeDepthType>;
    event: Readonly<EventTransaction>;
    filterSpans: FilterSpans | undefined;
    generateBounds: (bounds: SpanBoundsType) => SpanGeneratedBoundsType;
    hiddenSpanGroups: Set<String>;
    isLastSibling: boolean;
    isOnlySibling: boolean;
    operationNameFilters: ActiveOperationFilter;
    previousSiblingEndTimestamp: number | undefined;
    removeTraceBounds: (eventSlug: string) => void;
    showSpanGroup: boolean;
    spanGrouping: EnhancedSpan[] | undefined;
    spanGroups: Set<String>;
    toggleSpanGroup: (() => void) | undefined;
    treeDepth: number;
  }): EnhancedProcessedSpanType[] => {
    const {
      operationNameFilters,
      generateBounds,
      isLastSibling,
      hiddenSpanGroups,
      // The set of ancestor span IDs whose sub-tree that the span belongs to
      spanGroups,
      filterSpans,
      previousSiblingEndTimestamp,
      event,
      isOnlySibling,
      spanGrouping,
      toggleSpanGroup,
      showSpanGroup,
      addTraceBounds,
      removeTraceBounds,
    } = props;
    let {treeDepth, continuingTreeDepths} = props;

    const parentSpanID = getSpanID(this.span);
    const childSpanGroup = new Set(spanGroups);
    childSpanGroup.add(parentSpanID);

    const descendantsSource = this.showEmbeddedChildren
      ? [...this.embeddedChildren, ...this.children]
      : this.children;

    const isNotLastSpanOfGroup =
      isOnlySibling && !this.isRoot && descendantsSource.length === 1;
    const shouldGroup = isNotLastSpanOfGroup;
    const hideSpanTree = hiddenSpanGroups.has(parentSpanID);
    const isLastSpanOfGroup =
      isOnlySibling && !this.isRoot && (descendantsSource.length !== 1 || hideSpanTree);
    const isFirstSpanOfGroup =
      shouldGroup &&
      (spanGrouping === undefined ||
        (Array.isArray(spanGrouping) && spanGrouping.length === 0));

    if (
      isLastSpanOfGroup &&
      Array.isArray(spanGrouping) &&
      spanGrouping.length >= 1 &&
      !showSpanGroup
    ) {
      // We always want to indent the last span of the span group chain
      treeDepth = treeDepth + 1;

      // For a collapsed span group chain to be useful, we prefer span groupings
      // that are two or more spans.
      // Since there is no concept of "backtracking" when constructing the span tree,
      // we will need to reconstruct the tree depth information. This is only neccessary
      // when the span group chain is hidden/collapsed.
      if (spanGrouping.length === 1) {
        const treeDepthEntryFoo = isOrphanSpan(spanGrouping[0].span)
          ? ({type: 'orphan', depth: spanGrouping[0].treeDepth} as OrphanTreeDepth)
          : spanGrouping[0].treeDepth;

        if (!spanGrouping[0].isLastSibling) {
          continuingTreeDepths = [...continuingTreeDepths, treeDepthEntryFoo];
        }
      }
    }

    // Criteria for propagating information about the span group to the last span of the span group chain
    const spanGroupingCriteria =
      isLastSpanOfGroup && Array.isArray(spanGrouping) && spanGrouping.length > 1;

    const wrappedSpan: EnhancedSpan = {
      type: this.isRoot ? 'root_span' : 'span',
      span: this.span,
      numOfSpanChildren: descendantsSource.length,
      treeDepth,
      isLastSibling,
      continuingTreeDepths,
      fetchEmbeddedChildrenState: this.fetchEmbeddedChildrenState,
      showEmbeddedChildren: this.showEmbeddedChildren,
      toggleEmbeddedChildren: this.toggleEmbeddedChildren({
        addTraceBounds,
        removeTraceBounds,
      }),
      toggleSpanGroup:
        spanGroupingCriteria && toggleSpanGroup && !showSpanGroup
          ? toggleSpanGroup
          : isFirstSpanOfGroup && this.showSpanGroup && !hideSpanTree
          ? this.toggleSpanGroup
          : undefined,
      toggleSiblingSpanGroup: undefined,
    };

    if (wrappedSpan.type === 'root_span') {
      // @ts-expect-error
      delete wrappedSpan.toggleSpanGroup;
    }

    const treeDepthEntry = isOrphanSpan(this.span)
      ? ({type: 'orphan', depth: treeDepth} as OrphanTreeDepth)
      : treeDepth;

    const shouldHideSpanOfGroup =
      shouldGroup &&
      !isLastSpanOfGroup &&
      ((toggleSpanGroup === undefined && !this.showSpanGroup) ||
        (toggleSpanGroup !== undefined && !showSpanGroup));

    const descendantContinuingTreeDepths =
      isLastSibling || shouldHideSpanOfGroup
        ? continuingTreeDepths
        : [...continuingTreeDepths, treeDepthEntry];

    for (const hiddenSpanGroup of hiddenSpanGroups) {
      if (spanGroups.has(hiddenSpanGroup)) {
        // If this span is hidden, then all the descendants are hidden as well
        return [];
      }
    }

    // Check if the descendants in this span have consecutive similar siblings, and group them
    const groupedDescendants: SpanTreeModel[][] = [];
    if (descendantsSource?.length >= MIN_SIBLING_GROUP_SIZE) {
      let prevSpanModel = descendantsSource[0];
      let currentGroup = [prevSpanModel];

      for (let i = 1; i < descendantsSource.length; i++) {
        const currSpanModel = descendantsSource[i];

        // We want to group siblings only if they share the same op and description
        if (
          prevSpanModel.span.op === currSpanModel.span.op &&
          prevSpanModel.span.description === currSpanModel.span.description
        ) {
          currentGroup.push(currSpanModel);
        } else {
          groupedDescendants.push(currentGroup);
          currentGroup = [currSpanModel];
        }

        prevSpanModel = currSpanModel;
      }

      groupedDescendants.push(currentGroup);
    } else if (descendantsSource.length >= 1) {
      groupedDescendants.push(descendantsSource);
    }

    const {descendants} = (hideSpanTree ? [] : groupedDescendants).reduce(
      (
        acc: {
          descendants: EnhancedProcessedSpanType[];
          previousSiblingEndTimestamp: number | undefined;
        },
        group,
        groupIndex
      ) => {
        // Groups less than 5 indicate that the spans should be left ungrouped
        if (group.length < MIN_SIBLING_GROUP_SIZE) {
          group.forEach((spanModel, index) => {
            acc.descendants.push(
              ...spanModel.getSpansList({
                operationNameFilters,
                generateBounds,
                treeDepth: shouldHideSpanOfGroup ? treeDepth : treeDepth + 1,
                isLastSibling:
                  groupIndex === groupedDescendants.length - 1 &&
                  index === group.length - 1,
                continuingTreeDepths: descendantContinuingTreeDepths,
                hiddenSpanGroups,
                spanGroups: new Set(childSpanGroup),
                filterSpans,
                previousSiblingEndTimestamp: acc.previousSiblingEndTimestamp,
                event,
                isOnlySibling: descendantsSource.length === 1,
                spanGrouping: shouldGroup
                  ? [...(spanGrouping ?? []), wrappedSpan]
                  : undefined,
                toggleSpanGroup: isNotLastSpanOfGroup
                  ? toggleSpanGroup === undefined
                    ? this.toggleSpanGroup
                    : toggleSpanGroup
                  : undefined,
                showSpanGroup: isNotLastSpanOfGroup
                  ? toggleSpanGroup === undefined
                    ? this.showSpanGroup
                    : showSpanGroup
                  : false,
                addTraceBounds,
                removeTraceBounds,
              })
            );

            acc.previousSiblingEndTimestamp = spanModel.span.timestamp;
          });

          return acc;
        }

        // NOTE: I am making the assumption here that grouped sibling spans will not have children.
        // By making this assumption, I can immediately wrap the grouped spans here without having
        // to recursively traverse them.

        // This may not be the case, and needs to be looked into later

        const wrappedSiblings: EnhancedSpan[] = group.map((spanModel, index) => {
          const enhancedSibling: EnhancedSpan = {
            type: 'span',
            span: spanModel.span,
            numOfSpanChildren: 0,
            treeDepth: treeDepth + 1,
            isLastSibling: index === group.length - 1,
            isFirstSiblingOfGroup: index === 0,
            continuingTreeDepths,
            fetchEmbeddedChildrenState: spanModel.fetchEmbeddedChildrenState,
            showEmbeddedChildren: spanModel.showEmbeddedChildren,
            toggleEmbeddedChildren: spanModel.toggleEmbeddedChildren({
              addTraceBounds,
              removeTraceBounds,
            }),
            toggleSpanGroup: undefined,
            toggleSiblingSpanGroup: index === 0 ? this.toggleSiblingSpanGroup : undefined,
          };

          return enhancedSibling;
        });

        // Check if the group is currently expanded or not
        const key = `${group[0].span.op}.${group[0].span.description}`;
        if (this.ungroupedSiblings.has(key)) {
          acc.descendants.push(...wrappedSiblings);
          return acc;
        }

        const groupedSiblingsSpan: EnhancedProcessedSpanType = {
          type: 'span_group_sibling',
          span: this.span,
          treeDepth: treeDepth + 1,
          continuingTreeDepths,
          spanGrouping: wrappedSiblings,
          toggleSpanGroup: undefined,
          showSpanGroup,
          toggleSiblingSpanGroup: this.toggleSiblingSpanGroup,
        };

        acc.descendants.push(groupedSiblingsSpan);

        return acc;
      },
      {
        descendants: [],
        previousSiblingEndTimestamp: undefined,
      }
    );

    if (this.isSpanFilteredOut(props)) {
      return [
        {
          type: 'filtered_out',
          span: this.span,
        },
        ...descendants,
      ];
    }

    const bounds = generateBounds({
      startTimestamp: this.span.start_timestamp,
      endTimestamp: this.span.timestamp,
    });
    const isCurrentSpanOutOfView = !bounds.isSpanVisibleInView;

    if (isCurrentSpanOutOfView) {
      return [
        {
          type: 'out_of_view',
          span: this.span,
        },
        ...descendants,
      ];
    }

    if (shouldHideSpanOfGroup) {
      return [...descendants];
    }

    if (
      isLastSpanOfGroup &&
      Array.isArray(spanGrouping) &&
      spanGrouping.length > 1 &&
      !showSpanGroup &&
      wrappedSpan.type === 'span'
    ) {
      const spanGroupChain: EnhancedProcessedSpanType = {
        type: 'span_group_chain',
        span: this.span,
        treeDepth: treeDepth - 1,
        continuingTreeDepths,
        spanGrouping,
        showSpanGroup,
        toggleSpanGroup: wrappedSpan.toggleSpanGroup,
        toggleSiblingSpanGroup: undefined,
      };

      return [
        spanGroupChain,
        {...wrappedSpan, toggleSpanGroup: undefined},
        ...descendants,
      ];
    }

    if (
      isFirstSpanOfGroup &&
      this.showSpanGroup &&
      !hideSpanTree &&
      descendants.length <= 1 &&
      wrappedSpan.type === 'span'
    ) {
      // If we know the descendants will be one span or less, we remove the "regroup" feature (therefore hide it)
      // by setting toggleSpanGroup to be undefined for the first span of the group chain.
      wrappedSpan.toggleSpanGroup = undefined;
    }

    // Do not autogroup groups that will only have two spans
    if (isLastSpanOfGroup && Array.isArray(spanGrouping) && spanGrouping.length === 1) {
      if (!showSpanGroup) {
        const parentSpan = spanGrouping[0].span;
        const parentSpanBounds = generateBounds({
          startTimestamp: parentSpan.start_timestamp,
          endTimestamp: parentSpan.timestamp,
        });
        const isParentSpanOutOfView = !parentSpanBounds.isSpanVisibleInView;
        if (!isParentSpanOutOfView) {
          return [spanGrouping[0], wrappedSpan, ...descendants];
        }
      }

      return [wrappedSpan, ...descendants];
    }

    const gapSpan = this.generateSpanGap(
      event,
      previousSiblingEndTimestamp,
      treeDepth,
      continuingTreeDepths
    );

    if (gapSpan) {
      return [gapSpan, wrappedSpan, ...descendants];
    }

    return [wrappedSpan, ...descendants];
  };

  toggleEmbeddedChildren =
    ({
      addTraceBounds,
      removeTraceBounds,
    }: {
      addTraceBounds: (bounds: TraceBound) => void;
      removeTraceBounds: (eventSlug: string) => void;
    }) =>
    (props: {eventSlug: string; orgSlug: string}) => {
      this.showEmbeddedChildren = !this.showEmbeddedChildren;
      this.fetchEmbeddedChildrenState = 'idle';

      if (!this.showEmbeddedChildren) {
        if (this.embeddedChildren.length > 0) {
          this.embeddedChildren.forEach(child => {
            removeTraceBounds(child.generateTraceBounds().spanId);
          });
        }
      }

      if (this.showEmbeddedChildren) {
        if (this.embeddedChildren.length === 0) {
          return this.fetchEmbeddedTransactions({...props, addTraceBounds});
        }
        this.embeddedChildren.forEach(child => {
          addTraceBounds(child.generateTraceBounds());
        });
      }

      return Promise.resolve(undefined);
    };

  fetchEmbeddedTransactions({
    orgSlug,
    eventSlug,
    addTraceBounds,
  }: {
    addTraceBounds: (bounds: TraceBound) => void;
    eventSlug: string;
    orgSlug: string;
  }) {
    const url = `/organizations/${orgSlug}/events/${eventSlug}/`;

    this.fetchEmbeddedChildrenState = 'loading_embedded_transactions';

    return this.api
      .requestPromise(url, {
        method: 'GET',
        query: {},
      })
      .then(
        action('fetchEmbeddedTransactionsSuccess', (event: EventTransaction) => {
          if (!event) {
            return;
          }

          const parsedTrace = parseTrace(event);
          const rootSpan = generateRootSpan(parsedTrace);
          const parsedRootSpan = new SpanTreeModel(
            rootSpan,
            parsedTrace.childSpans,
            this.api,
            false
          );

          this.embeddedChildren = [parsedRootSpan];
          this.fetchEmbeddedChildrenState = 'idle';
          addTraceBounds(parsedRootSpan.generateTraceBounds());
        })
      )
      .catch(
        action('fetchEmbeddedTransactionsError', () => {
          this.embeddedChildren = [];
          this.fetchEmbeddedChildrenState = 'error_fetching_embedded_transactions';
        })
      );
  }

  toggleSpanGroup = () => {
    this.showSpanGroup = !this.showSpanGroup;
  };

  toggleSiblingSpanGroup = (operation: string, description: string) => {
    const key = `${operation}.${description}`;

    if (this.ungroupedSiblings.has(key)) {
      this.ungroupedSiblings.delete(key);
    } else {
      this.ungroupedSiblings.add(`${operation}.${description}`);
    }
  };

  generateTraceBounds = (): TraceBound => {
    return {
      spanId: this.span.span_id,
      traceStartTimestamp: this.span.start_timestamp,
      traceEndTimestamp: this.span.timestamp,
    };
  };
}

export default SpanTreeModel;
