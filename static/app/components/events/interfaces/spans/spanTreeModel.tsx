import {action, computed, makeObservable, observable} from 'mobx';

import type {Client} from 'sentry/api';
import {t} from 'sentry/locale';
import type {AggregateEventTransaction, EventTransaction} from 'sentry/types/event';
import type {TraceInfo} from 'sentry/views/performance/traceDetails/types';

import type {ActiveOperationFilter} from './filter';
import type {
  DescendantGroup,
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
import type {SpanBoundsType, SpanGeneratedBoundsType} from './utils';
import {
  generateRootSpan,
  getSiblingGroupKey,
  getSpanID,
  getSpanOperation,
  groupShouldBeHidden,
  isEventFromBrowserJavaScriptSDK,
  isOrphanSpan,
  parseTrace,
  SpanSubTimingMark,
  subTimingMarkToTime,
} from './utils';

export const MIN_SIBLING_GROUP_SIZE = 5;

class SpanTreeModel {
  api: Client;

  // readonly state
  span: Readonly<SpanType>;
  children: SpanTreeModel[] = [];
  isRoot: boolean;

  // readable/writable state
  fetchEmbeddedChildrenState: FetchEmbeddedChildrenState = 'idle';
  showEmbeddedChildren = false;
  embeddedChildren: SpanTreeModel[] = [];
  isEmbeddedTransactionTimeAdjusted = false;
  // This controls if a chain of nested spans that are the only sibling to be visually grouped together or not.
  // On initial render, they're visually grouped together.
  isNestedSpanGroupExpanded = false;
  // Entries in this set will follow the format 'op.description'.
  // An entry in this set indicates that all siblings with the op and description should be left ungrouped
  expandedSiblingGroups: Set<string> = new Set();

  traceInfo: TraceInfo | undefined = undefined;

  constructor(
    parentSpan: SpanType,
    childSpans: SpanChildrenLookupType,
    api: Client,
    isRoot = false,
    traceInfo?: TraceInfo
  ) {
    this.api = api;
    this.span = parentSpan;
    this.isRoot = isRoot;
    this.traceInfo = traceInfo;
    const spanID = getSpanID(parentSpan);
    const spanChildren: RawSpanType[] = childSpans?.[spanID] ?? [];

    // Mark descendents as being rendered. This is to address potential recursion issues due to malformed data.
    // For example if a span has a span_id that's identical to its parent_span_id.
    childSpans = {
      ...childSpans,
    };
    delete childSpans[spanID];

    this.children = spanChildren.map(span => {
      return new SpanTreeModel(span, childSpans, api, false, this.traceInfo);
    });

    makeObservable(this, {
      operationNameCounts: computed.struct,
      showEmbeddedChildren: observable,
      embeddedChildren: observable,
      fetchEmbeddedChildrenState: observable,
      fetchEmbeddedTransactions: action,
      isNestedSpanGroupExpanded: observable,
      toggleNestedSpanGroup: action,
      expandedSiblingGroups: observable,
      toggleSiblingSpanGroup: action,
      isEmbeddedTransactionTimeAdjusted: observable,
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

  isSpanFilteredOut = (
    props: {
      filterSpans: FilterSpans | undefined;
      operationNameFilters: ActiveOperationFilter;
    },
    spanModel: SpanTreeModel
  ): boolean => {
    const {operationNameFilters, filterSpans} = props;

    if (operationNameFilters.type === 'active_filter') {
      const operationName = getSpanOperation(spanModel.span);

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

    return !filterSpans.spanIDs.has(getSpanID(spanModel.span));
  };

  generateSpanGap(
    span: SpanType,
    event: Readonly<EventTransaction | AggregateEventTransaction>,
    previousSiblingEndTimestamp: number | undefined,
    treeDepth: number,
    continuingTreeDepths: TreeDepthType[]
  ): EnhancedProcessedSpanType | undefined {
    // hide gap spans (i.e. "missing instrumentation" spans) for browser js transactions,
    // since they're not useful to indicate
    const shouldIncludeGap = !isEventFromBrowserJavaScriptSDK(event);

    const isValidGap =
      shouldIncludeGap &&
      typeof previousSiblingEndTimestamp === 'number' &&
      previousSiblingEndTimestamp < span.start_timestamp &&
      // gap is at least 100 ms
      span.start_timestamp - previousSiblingEndTimestamp >= 0.1;
    if (!isValidGap) {
      return undefined;
    }

    const gapSpan: EnhancedProcessedSpanType = {
      type: 'gap',
      span: {
        type: 'gap',
        start_timestamp: previousSiblingEndTimestamp || span.start_timestamp,
        timestamp: span.start_timestamp, // this is essentially end_timestamp
        description: t('Missing span instrumentation'),
        isOrphan: isOrphanSpan(span),
      },
      numOfSpanChildren: 0,
      treeDepth,
      isLastSibling: false,
      continuingTreeDepths,
      fetchEmbeddedChildrenState: 'idle',
      showEmbeddedChildren: false,
      toggleEmbeddedChildren: undefined,
      isEmbeddedTransactionTimeAdjusted: this.isEmbeddedTransactionTimeAdjusted,
    };
    return gapSpan;
  }

  getSpansList = (props: {
    addTraceBounds: (bounds: TraceBound) => void;
    continuingTreeDepths: TreeDepthType[];
    directParent: SpanTreeModel | null;
    event: Readonly<EventTransaction | AggregateEventTransaction>;
    filterSpans: FilterSpans | undefined;
    generateBounds: (bounds: SpanBoundsType) => SpanGeneratedBoundsType;
    hiddenSpanSubTrees: Set<string>;
    isLastSibling: boolean;
    isNestedSpanGroupExpanded: boolean;
    isOnlySibling: boolean;
    operationNameFilters: ActiveOperationFilter;
    previousSiblingEndTimestamp: number | undefined;
    removeTraceBounds: (eventSlug: string) => void;
    spanAncestors: Set<string>;
    spanNestedGrouping: EnhancedSpan[] | undefined;
    toggleNestedSpanGroup: (() => void) | undefined;
    treeDepth: number;
    focusedSpanIds?: Set<string>;
  }): EnhancedProcessedSpanType[] => {
    const {
      operationNameFilters,
      generateBounds,
      isLastSibling,
      hiddenSpanSubTrees,
      // The set of ancestor span IDs whose sub-tree that the span belongs to
      spanAncestors,
      filterSpans,
      previousSiblingEndTimestamp,
      event,
      isOnlySibling,
      spanNestedGrouping,
      toggleNestedSpanGroup,
      isNestedSpanGroupExpanded,
      addTraceBounds,
      removeTraceBounds,
      focusedSpanIds,
    } = props;
    let {treeDepth, continuingTreeDepths} = props;
    const parentSpanID = getSpanID(this.span);
    const nextSpanAncestors = new Set(spanAncestors);
    nextSpanAncestors.add(parentSpanID);

    const descendantsSource = this.showEmbeddedChildren
      ? [...this.embeddedChildren, ...this.children]
      : this.children;

    const isNotLastSpanOfGroup =
      isOnlySibling && !this.isRoot && descendantsSource.length === 1;
    const shouldGroup = isNotLastSpanOfGroup;
    const hideSpanTree = hiddenSpanSubTrees.has(parentSpanID);
    const isLastSpanOfGroup =
      isOnlySibling && !this.isRoot && (descendantsSource.length !== 1 || hideSpanTree);
    const isFirstSpanOfGroup =
      shouldGroup &&
      (spanNestedGrouping === undefined ||
        (Array.isArray(spanNestedGrouping) && spanNestedGrouping.length === 0));

    if (
      isLastSpanOfGroup &&
      Array.isArray(spanNestedGrouping) &&
      spanNestedGrouping.length >= 1 &&
      !isNestedSpanGroupExpanded
    ) {
      // We always want to indent the last span of the span group chain
      treeDepth = treeDepth + 1;

      // For a collapsed span group chain to be useful, we prefer span groupings
      // that are two or more spans.
      // Since there is no concept of "backtracking" when constructing the span tree,
      // we will need to reconstruct the tree depth information. This is only neccessary
      // when the span group chain is hidden/collapsed.
      if (spanNestedGrouping.length === 1) {
        const treeDepthEntry = isOrphanSpan(spanNestedGrouping[0]!.span)
          ? ({type: 'orphan', depth: spanNestedGrouping[0]!.treeDepth} as OrphanTreeDepth)
          : spanNestedGrouping[0]!.treeDepth;

        if (!spanNestedGrouping[0]!.isLastSibling) {
          continuingTreeDepths = [...continuingTreeDepths, treeDepthEntry];
        }
      }
    }

    // Criteria for propagating information about the span group to the last span of the span group chain
    const spanGroupingCriteria =
      isLastSpanOfGroup &&
      Array.isArray(spanNestedGrouping) &&
      spanNestedGrouping.length > 1;

    const wrappedSpan: EnhancedSpan = {
      type: this.isRoot ? 'root_span' : 'span',
      span: this.span,
      numOfSpanChildren: descendantsSource.length,
      treeDepth,
      isLastSibling,
      continuingTreeDepths,
      fetchEmbeddedChildrenState: this.fetchEmbeddedChildrenState,
      showEmbeddedChildren: this.showEmbeddedChildren,
      toggleEmbeddedChildren: this.makeToggleEmbeddedChildren({
        addTraceBounds,
        removeTraceBounds,
      }),
      toggleNestedSpanGroup:
        spanGroupingCriteria && toggleNestedSpanGroup && !isNestedSpanGroupExpanded
          ? toggleNestedSpanGroup
          : isFirstSpanOfGroup && this.isNestedSpanGroupExpanded && !hideSpanTree
            ? this.toggleNestedSpanGroup
            : undefined,
      toggleSiblingSpanGroup: undefined,
      isEmbeddedTransactionTimeAdjusted: this.isEmbeddedTransactionTimeAdjusted,
    };

    if (wrappedSpan.type === 'root_span') {
      delete (wrappedSpan as any).toggleNestedSpanGroup;
    }

    const treeDepthEntry = isOrphanSpan(this.span)
      ? ({type: 'orphan', depth: treeDepth} as OrphanTreeDepth)
      : treeDepth;

    const shouldHideSpanOfGroup =
      shouldGroup &&
      !isLastSpanOfGroup &&
      ((toggleNestedSpanGroup === undefined && !this.isNestedSpanGroupExpanded) ||
        (toggleNestedSpanGroup !== undefined && !isNestedSpanGroupExpanded));

    const descendantContinuingTreeDepths =
      isLastSibling || shouldHideSpanOfGroup
        ? continuingTreeDepths
        : [...continuingTreeDepths, treeDepthEntry];

    for (const hiddenSpanSubTree of hiddenSpanSubTrees) {
      if (spanAncestors.has(hiddenSpanSubTree)) {
        // If this span is hidden, then all the descendants are hidden as well
        return [];
      }
    }

    const groupedDescendants: DescendantGroup[] = [];
    // Used to number sibling groups in case there are multiple groups with the same op and description
    const siblingGroupOccurrenceMap: Record<string, number> = {};

    const addGroupToMap = (prevSpanModel: SpanTreeModel, group: SpanTreeModel[]) => {
      if (!group.length) {
        return;
      }

      const groupKey = `${prevSpanModel.span.op}.${prevSpanModel.span.description}`;

      if (!siblingGroupOccurrenceMap[groupKey]) {
        siblingGroupOccurrenceMap[groupKey] = 1;
      } else {
        siblingGroupOccurrenceMap[groupKey] += 1;
      }

      groupedDescendants.push({
        group,
        occurrence: siblingGroupOccurrenceMap[groupKey],
      });
    };

    if (descendantsSource?.length >= MIN_SIBLING_GROUP_SIZE) {
      let prevSpanModel = descendantsSource[0]!;
      let currentGroup = [prevSpanModel];

      for (let i = 1; i < descendantsSource.length; i++) {
        const currSpanModel = descendantsSource[i]!;

        // We want to group siblings only if they share the same op and description, and if they have no children
        if (
          prevSpanModel.span.op === currSpanModel.span.op &&
          prevSpanModel.span.description === currSpanModel.span.description &&
          currSpanModel.children.length === 0
        ) {
          currentGroup.push(currSpanModel);
        } else {
          addGroupToMap(prevSpanModel, currentGroup);

          if (currSpanModel.children.length) {
            currentGroup = [currSpanModel];
            groupedDescendants.push({group: currentGroup});
            currentGroup = [];
          } else {
            currentGroup = [currSpanModel];
          }
        }

        prevSpanModel = currSpanModel;
      }

      addGroupToMap(prevSpanModel, currentGroup);
    } else if (descendantsSource.length >= 1) {
      groupedDescendants.push({group: descendantsSource});
    }

    const descendants = (hideSpanTree ? [] : groupedDescendants).reduce(
      (
        acc: {
          descendants: EnhancedProcessedSpanType[];
          previousSiblingEndTimestamp: number | undefined;
        },
        {group, occurrence},
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
                hiddenSpanSubTrees,
                spanAncestors: new Set(nextSpanAncestors),
                filterSpans,
                previousSiblingEndTimestamp: acc.previousSiblingEndTimestamp,
                event,
                isOnlySibling: descendantsSource.length === 1,
                spanNestedGrouping: shouldGroup
                  ? [...(spanNestedGrouping ?? []), wrappedSpan]
                  : undefined,
                toggleNestedSpanGroup: isNotLastSpanOfGroup
                  ? toggleNestedSpanGroup === undefined
                    ? this.toggleNestedSpanGroup
                    : toggleNestedSpanGroup
                  : undefined,
                isNestedSpanGroupExpanded: isNotLastSpanOfGroup
                  ? toggleNestedSpanGroup === undefined
                    ? this.isNestedSpanGroupExpanded
                    : isNestedSpanGroupExpanded
                  : false,
                addTraceBounds,
                removeTraceBounds,
                focusedSpanIds,
                directParent: this,
              })
            );

            acc.previousSiblingEndTimestamp = spanModel.span.timestamp;
          });

          return acc;
        }

        const key = getSiblingGroupKey(group[0]!.span, occurrence);
        if (this.expandedSiblingGroups.has(key)) {
          // This check is needed here, since it is possible that a user could be filtering for a specific span ID.
          // In this case, we must add only the specified span into the accumulator's descendants
          group.forEach((spanModel, index) => {
            if (
              this.isSpanFilteredOut(props, spanModel) ||
              (focusedSpanIds && !focusedSpanIds.has(spanModel.span.span_id))
            ) {
              acc.descendants.push({
                type: 'filtered_out',
                span: spanModel.span,
              });
            } else {
              const enhancedSibling: EnhancedSpan = {
                type: 'span',
                span: spanModel.span,
                numOfSpanChildren: 0,
                treeDepth: treeDepth + 1,
                isLastSibling:
                  index === group.length - 1 &&
                  groupIndex === groupedDescendants.length - 1,
                isFirstSiblingOfGroup: index === 0,
                groupOccurrence: occurrence,
                continuingTreeDepths: descendantContinuingTreeDepths,
                fetchEmbeddedChildrenState: spanModel.fetchEmbeddedChildrenState,
                showEmbeddedChildren: spanModel.showEmbeddedChildren,
                toggleEmbeddedChildren: spanModel.makeToggleEmbeddedChildren({
                  addTraceBounds,
                  removeTraceBounds,
                }),
                toggleNestedSpanGroup: undefined,
                toggleSiblingSpanGroup:
                  index === 0 ? this.toggleSiblingSpanGroup : undefined,
                isEmbeddedTransactionTimeAdjusted:
                  spanModel.isEmbeddedTransactionTimeAdjusted,
              };

              const bounds = generateBounds({
                startTimestamp: spanModel.span.start_timestamp,
                endTimestamp: spanModel.span.timestamp,
              });

              const gapSpan = this.generateSpanGap(
                group[0]!.span,
                event,
                acc.previousSiblingEndTimestamp,
                treeDepth + 1,
                continuingTreeDepths
              );

              if (gapSpan) {
                acc.descendants.push(gapSpan);
              }

              acc.previousSiblingEndTimestamp = spanModel.span.timestamp;

              // It's possible that a section in the minimap is selected so some spans in this group may be out of view
              acc.descendants.push(
                bounds.isSpanVisibleInView
                  ? enhancedSibling
                  : {
                      type: 'filtered_out',
                      span: spanModel.span,
                    }
              );
            }
          });

          return acc;
        }

        // Since we are not recursively traversing elements in this group, need to check
        // if the spans are filtered or out of bounds here

        if (
          this.isSpanFilteredOut(props, group[0]!) ||
          groupShouldBeHidden(group, focusedSpanIds)
        ) {
          group.forEach(spanModel => {
            acc.descendants.push({
              type: 'filtered_out',
              span: spanModel.span,
            });
          });
          return acc;
        }

        const bounds = generateBounds({
          startTimestamp: group[0]!.span.start_timestamp,
          endTimestamp: group[group.length - 1]!.span.timestamp,
        });

        if (!bounds.isSpanVisibleInView) {
          group.forEach(spanModel =>
            acc.descendants.push({
              type: 'out_of_view',
              span: spanModel.span,
            })
          );
          return acc;
        }

        const gapSpan = this.generateSpanGap(
          group[0]!.span,
          event,
          acc.previousSiblingEndTimestamp,
          treeDepth + 1,
          continuingTreeDepths
        );

        if (gapSpan) {
          acc.descendants.push(gapSpan);
        }

        // Since the group is not expanded, return a singular grouped span bar
        const wrappedSiblings: EnhancedSpan[] = group.map((spanModel, index) => {
          const enhancedSibling: EnhancedSpan = {
            type: 'span',
            span: spanModel.span,
            numOfSpanChildren: 0,
            treeDepth: treeDepth + 1,
            isLastSibling:
              index === group.length - 1 && groupIndex === groupedDescendants.length - 1,
            isFirstSiblingOfGroup: index === 0,
            groupOccurrence: occurrence,
            continuingTreeDepths: descendantContinuingTreeDepths,
            fetchEmbeddedChildrenState: spanModel.fetchEmbeddedChildrenState,
            showEmbeddedChildren: spanModel.showEmbeddedChildren,
            toggleEmbeddedChildren: spanModel.makeToggleEmbeddedChildren({
              addTraceBounds,
              removeTraceBounds,
            }),
            toggleNestedSpanGroup: undefined,
            toggleSiblingSpanGroup: index === 0 ? this.toggleSiblingSpanGroup : undefined,
            isEmbeddedTransactionTimeAdjusted:
              spanModel.isEmbeddedTransactionTimeAdjusted,
          };

          return enhancedSibling;
        });

        const groupedSiblingsSpan: EnhancedProcessedSpanType = {
          type: 'span_group_siblings',
          span: this.span,
          treeDepth: treeDepth + 1,
          continuingTreeDepths: descendantContinuingTreeDepths,
          spanSiblingGrouping: wrappedSiblings,
          isLastSibling: groupIndex === groupedDescendants.length - 1,
          occurrence: occurrence ?? 0,
          toggleSiblingSpanGroup: this.toggleSiblingSpanGroup,
        };

        acc.previousSiblingEndTimestamp =
          wrappedSiblings[wrappedSiblings.length - 1]!.span.timestamp;

        acc.descendants.push(groupedSiblingsSpan);
        return acc;
      },
      {
        descendants: [],
        previousSiblingEndTimestamp: undefined,
      }
    ).descendants;

    if (
      this.isSpanFilteredOut(props, this) ||
      (focusedSpanIds && !focusedSpanIds.has(this.span.span_id))
    ) {
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
      Array.isArray(spanNestedGrouping) &&
      spanNestedGrouping.length > 1 &&
      !isNestedSpanGroupExpanded &&
      wrappedSpan.type === 'span'
    ) {
      const spanGroupChain: EnhancedProcessedSpanType = {
        type: 'span_group_chain',
        span: this.span,
        treeDepth: treeDepth - 1,
        continuingTreeDepths,
        spanNestedGrouping,
        isNestedSpanGroupExpanded,
        toggleNestedSpanGroup: wrappedSpan.toggleNestedSpanGroup,
        toggleSiblingSpanGroup: undefined,
      };

      return [
        spanGroupChain,
        {...wrappedSpan, toggleNestedSpanGroup: undefined},
        ...descendants,
      ];
    }

    if (
      isFirstSpanOfGroup &&
      this.isNestedSpanGroupExpanded &&
      !hideSpanTree &&
      descendants.length <= 1 &&
      wrappedSpan.type === 'span'
    ) {
      // If we know the descendants will be one span or less, we remove the "regroup" feature (therefore hide it)
      // by setting toggleNestedSpanGroup to be undefined for the first span of the group chain.
      wrappedSpan.toggleNestedSpanGroup = undefined;
    }

    // Do not autogroup groups that will only have two spans
    if (
      isLastSpanOfGroup &&
      Array.isArray(spanNestedGrouping) &&
      spanNestedGrouping.length === 1
    ) {
      if (!isNestedSpanGroupExpanded) {
        const parentSpan = spanNestedGrouping[0]!.span;
        const parentSpanBounds = generateBounds({
          startTimestamp: parentSpan.start_timestamp,
          endTimestamp: parentSpan.timestamp,
        });
        const isParentSpanOutOfView = !parentSpanBounds.isSpanVisibleInView;
        if (!isParentSpanOutOfView) {
          return [spanNestedGrouping[0]!, wrappedSpan, ...descendants];
        }
      }

      return [wrappedSpan, ...descendants];
    }

    const gapSpan = this.generateSpanGap(
      this.span,
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

  makeToggleEmbeddedChildren = ({
    addTraceBounds,
    removeTraceBounds,
  }: {
    addTraceBounds: (bounds: TraceBound) => void;
    removeTraceBounds: (eventSlug: string) => void;
  }) =>
    action('toggleEmbeddedChildren', (orgSlug: string, eventSlugs: string[]) => {
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
          return this.fetchEmbeddedTransactions({
            orgSlug,
            eventSlugs,
            addTraceBounds,
          });
        }
        this.embeddedChildren.forEach(child => {
          addTraceBounds(child.generateTraceBounds());
        });
      }

      return Promise.resolve(undefined);
    });

  fetchEmbeddedTransactions({
    orgSlug,
    eventSlugs,
    addTraceBounds,
  }: {
    addTraceBounds: (bounds: TraceBound) => void;
    eventSlugs: string[];
    orgSlug: string;
  }) {
    const urls = eventSlugs.map(
      eventSlug => `/organizations/${orgSlug}/events/${eventSlug}/`
    );

    this.fetchEmbeddedChildrenState = 'loading_embedded_transactions';

    const promiseArray = urls.map(url =>
      this.api
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

            // We need to adjust the timestamps for this embedded transaction only if it is not within the bounds of its parent span
            if (
              parsedTrace.traceStartTimestamp < this.span.start_timestamp ||
              parsedTrace.traceEndTimestamp > this.span.timestamp
            ) {
              const responseStart = subTimingMarkToTime(
                this.span,
                SpanSubTimingMark.HTTP_RESPONSE_START
              ); // Response start is a better approximation

              const spanTimeOffset =
                responseStart && !this.traceInfo
                  ? responseStart - parsedTrace.traceEndTimestamp
                  : this.span.start_timestamp - parsedTrace.traceStartTimestamp;

              parsedTrace.traceStartTimestamp += spanTimeOffset;
              parsedTrace.traceEndTimestamp += spanTimeOffset;

              parsedTrace.spans.forEach(span => {
                span.start_timestamp += spanTimeOffset;
                span.timestamp += spanTimeOffset;
              });

              this.isEmbeddedTransactionTimeAdjusted = true;
            }

            const rootSpan = generateRootSpan(parsedTrace);
            const parsedRootSpan = new SpanTreeModel(
              rootSpan,
              parsedTrace.childSpans,
              this.api,
              false,
              this.traceInfo
            );
            this.embeddedChildren.push(parsedRootSpan);
            this.fetchEmbeddedChildrenState = 'idle';
            addTraceBounds(parsedRootSpan.generateTraceBounds());
          })
        )
        .catch(
          action('fetchEmbeddedTransactionsError', () => {
            this.embeddedChildren = [];
            this.fetchEmbeddedChildrenState = 'error_fetching_embedded_transactions';
          })
        )
    );

    return Promise.all(promiseArray);
  }

  toggleNestedSpanGroup = () => {
    this.isNestedSpanGroupExpanded = !this.isNestedSpanGroupExpanded;
  };

  toggleSiblingSpanGroup = (span: SpanType, occurrence?: number) => {
    const key = getSiblingGroupKey(span, occurrence);

    if (this.expandedSiblingGroups.has(key)) {
      this.expandedSiblingGroups.delete(key);
    } else {
      this.expandedSiblingGroups.add(key);
    }
  };

  generateTraceBounds = (): TraceBound => {
    return {
      spanId: this.span.span_id,
      traceStartTimestamp: this.traceInfo
        ? this.traceInfo.startTimestamp
        : this.span.start_timestamp,
      traceEndTimestamp: this.traceInfo
        ? this.traceInfo.endTimestamp
        : this.span.timestamp,
    };
  };
}

export default SpanTreeModel;
