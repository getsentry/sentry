import type React from 'react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import * as qs from 'query-string';

import {Button} from 'sentry/components/button';
import {useHasNewTagsUI} from 'sentry/components/events/eventTags/util';
import useFeedbackWidget from 'sentry/components/feedback/widget/useFeedbackWidget';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {browserHistory} from 'sentry/utils/browserHistory';
import EventView from 'sentry/utils/discover/eventView';
import type {
  TraceFullDetailed,
  TraceMeta,
  TraceSplitResults,
} from 'sentry/utils/performance/quickTrace/types';
import {
  cancelAnimationTimeout,
  requestAnimationTimeout,
} from 'sentry/utils/profiling/hooks/useVirtualizedTree/virtualizedTreeUtils';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import {capitalize} from 'sentry/utils/string/capitalize';
import useApi from 'sentry/utils/useApi';
import {
  type DispatchingReducerMiddleware,
  useDispatchingReducer,
} from 'sentry/utils/useDispatchingReducer';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import useProjects from 'sentry/utils/useProjects';
import {traceAnalytics} from 'sentry/views/performance/newTraceDetails/traceAnalytics';
import {
  type ViewManagerScrollAnchor,
  VirtualizedViewManager,
} from 'sentry/views/performance/newTraceDetails/traceRenderers/virtualizedViewManager';
import {TraceShortcuts} from 'sentry/views/performance/newTraceDetails/traceShortcutsModal';
import {
  loadTraceViewPreferences,
  storeTraceViewPreferences,
} from 'sentry/views/performance/newTraceDetails/traceState/tracePreferences';

import {useTrace} from './traceApi/useTrace';
import {useTraceMeta} from './traceApi/useTraceMeta';
import {useTraceRootEvent} from './traceApi/useTraceRootEvent';
import {TraceDrawer} from './traceDrawer/traceDrawer';
import {TraceTree, type TraceTreeNode} from './traceModels/traceTree';
import {TraceSearchInput} from './traceSearch/traceSearchInput';
import {searchInTraceTree} from './traceState/traceSearch';
import {isTraceNode} from './guards';
import {Trace} from './trace';
import {TraceMetadataHeader} from './traceMetadataHeader';
import {TraceReducer, type TraceReducerState} from './traceState';
import {TraceType} from './traceType';
import {TraceUXChangeAlert} from './traceUXChangeBanner';
import {useTraceQueryParamStateSync} from './useTraceQueryParamStateSync';

function decodeScrollQueue(maybePath: unknown): TraceTree.NodePath[] | null {
  if (Array.isArray(maybePath)) {
    return maybePath;
  }

  if (typeof maybePath === 'string') {
    return [maybePath as TraceTree.NodePath];
  }

  return null;
}

function logTraceType(type: TraceType, organization: Organization) {
  switch (type) {
    case TraceType.BROKEN_SUBTRACES:
    case TraceType.EMPTY_TRACE:
    case TraceType.MULTIPLE_ROOTS:
    case TraceType.ONE_ROOT:
    case TraceType.NO_ROOT:
    case TraceType.ONLY_ERRORS:
      traceAnalytics.trackTraceShape(type, organization);
      break;
    default: {
      Sentry.captureMessage('Unknown trace type');
    }
  }
}

export function TraceView() {
  const params = useParams<{traceSlug?: string}>();
  const organization = useOrganization();
  const hasNewTagsUI = useHasNewTagsUI();

  const traceSlug = useMemo(() => {
    const slug = params.traceSlug?.trim() ?? '';
    // null and undefined are not valid trace slugs, but they can be passed
    // in the URL and need to check for their string coerced values.
    if (!slug || slug === 'null' || slug === 'undefined') {
      Sentry.withScope(scope => {
        scope.setFingerprint(['trace-null-slug']);
        Sentry.captureMessage(`Trace slug is empty`);
      });
    }
    return slug;
  }, [params.traceSlug]);

  useLayoutEffect(() => {
    if (hasNewTagsUI) {
      return;
    }

    // Enables the new trace tags/contexts ui for the trace view
    const queryString = qs.parse(window.location.search);
    queryString.traceView = '1';
    browserHistory.replace({
      pathname: window.location.pathname,
      query: queryString,
    });
  }, [traceSlug, hasNewTagsUI]);

  useEffect(() => {
    trackAnalytics('performance_views.trace_view_v1_page_load', {
      organization,
    });
  }, [organization]);

  const queryParams = useMemo(() => {
    const normalizedParams = normalizeDateTimeParams(qs.parse(location.search), {
      allowAbsolutePageDatetime: true,
    });
    const start = decodeScalar(normalizedParams.start);
    const timestamp = decodeScalar(normalizedParams.timestamp);
    const end = decodeScalar(normalizedParams.end);
    const statsPeriod = decodeScalar(normalizedParams.statsPeriod);

    return {start, end, statsPeriod, timestamp, useSpans: 1};
  }, []);

  const traceEventView = useMemo(() => {
    const {start, end, statsPeriod, timestamp} = queryParams;

    let startTimeStamp = start;
    let endTimeStamp = end;

    // If timestamp exists in the query params, we want to use it to set the start and end time
    // with a buffer of 1.5 days, for retrieving events belonging to the trace.
    if (timestamp) {
      const parsedTimeStamp = Number(timestamp);

      if (isNaN(parsedTimeStamp)) {
        throw new Error('Invalid timestamp');
      }

      const buffer = 36 * 60 * 60 * 1000; // 1.5 days in milliseconds
      const dateFromTimestamp = new Date(parsedTimeStamp * 1000);

      startTimeStamp = new Date(dateFromTimestamp.getTime() - buffer).toISOString();
      endTimeStamp = new Date(dateFromTimestamp.getTime() + buffer).toISOString();
    }

    return EventView.fromSavedQuery({
      id: undefined,
      name: `Events with Trace ID ${traceSlug}`,
      fields: ['title', 'event.type', 'project', 'timestamp'],
      orderby: '-timestamp',
      query: `trace:${traceSlug}`,
      projects: [ALL_ACCESS_PROJECTS],
      version: 2,
      start: startTimeStamp,
      end: endTimeStamp,
      range: !(startTimeStamp || endTimeStamp) ? statsPeriod : undefined,
    });
  }, [queryParams, traceSlug]);

  const trace = useTrace();
  const meta = useTraceMeta();

  return (
    <SentryDocumentTitle
      title={`${t('Trace')} - ${traceSlug}`}
      orgSlug={organization.slug}
    >
      <NoProjectMessage organization={organization}>
        <TraceViewContent
          status={trace.status}
          trace={trace.data ?? null}
          traceSlug={traceSlug}
          organization={organization}
          traceEventView={traceEventView}
          metaResults={meta}
        />
      </NoProjectMessage>
    </SentryDocumentTitle>
  );
}

const TRACE_TAB: TraceReducerState['tabs']['tabs'][0] = {
  node: 'trace',
  label: t('Trace'),
};

const VITALS_TAB: TraceReducerState['tabs']['tabs'][0] = {
  node: 'vitals',
  label: t('Vitals'),
};

const STATIC_DRAWER_TABS: TraceReducerState['tabs']['tabs'] = [TRACE_TAB];

type TraceViewContentProps = {
  metaResults: UseApiQueryResult<TraceMeta | null, any>;
  organization: Organization;
  status: UseApiQueryResult<any, any>['status'];
  trace: TraceSplitResults<TraceFullDetailed> | null;
  traceEventView: EventView;
  traceSlug: string;
};

function TraceViewContent(props: TraceViewContentProps) {
  const api = useApi();
  const organization = props.organization;
  const {projects} = useProjects();
  const rootEvent = useTraceRootEvent(props.trace);
  const loadingTraceRef = useRef<TraceTree | null>(null);
  const [forceRender, rerender] = useReducer(x => x + (1 % 2), 0);

  const initializedRef = useRef(false);
  const scrollQueueRef = useRef<{eventId?: string; path?: TraceTree.NodePath[]} | null>(
    null
  );

  const previouslyFocusedNodeRef = useRef<TraceTreeNode<TraceTree.NodeValue> | null>(
    null
  );
  const previouslyScrolledToNodeRef = useRef<TraceTreeNode<TraceTree.NodeValue> | null>(
    null
  );

  const tree = useMemo(() => {
    if (props.status === 'error') {
      const errorTree = TraceTree.Error(
        {
          project_slug: projects?.[0]?.slug ?? '',
          event_id: props.traceSlug,
        },
        loadingTraceRef.current
      );
      return errorTree;
    }

    if (
      props.trace?.transactions.length === 0 &&
      props.trace?.orphan_errors.length === 0
    ) {
      return TraceTree.Empty();
    }

    if (props.status === 'loading') {
      const loadingTrace =
        loadingTraceRef.current ??
        TraceTree.Loading(
          {
            project_slug: projects?.[0]?.slug ?? '',
            event_id: props.traceSlug,
          },
          loadingTraceRef.current
        );

      loadingTraceRef.current = loadingTrace;
      return loadingTrace;
    }

    if (props.trace) {
      return TraceTree.FromTrace(props.trace);
    }

    throw new Error('Invalid trace state');
  }, [props.traceSlug, props.trace, props.status, projects]);

  const initialQuery = useMemo((): string | undefined => {
    const query = qs.parse(location.search);

    if (typeof query.search === 'string') {
      return query.search;
    }
    return undefined;
    // We only want to decode on load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const preferences = useMemo(() => loadTraceViewPreferences(), []);

  const [traceState, traceDispatch, traceStateEmitter] = useDispatchingReducer(
    TraceReducer,
    {
      rovingTabIndex: {
        index: null,
        items: null,
        node: null,
      },
      search: {
        node: null,
        query: initialQuery,
        resultIteratorIndex: null,
        resultIndex: null,
        results: null,
        status: undefined,
        resultsLookup: new Map(),
      },
      preferences,
      tabs: {
        tabs: STATIC_DRAWER_TABS,
        current_tab: STATIC_DRAWER_TABS[0] ?? null,
        last_clicked_tab: null,
      },
    }
  );

  // Assign the trace state to a ref so we can access it without re-rendering
  const traceStateRef = useRef<TraceReducerState>(traceState);
  traceStateRef.current = traceState;

  // Initialize the view manager right after the state reducer
  const viewManager = useMemo(() => {
    return new VirtualizedViewManager({
      list: {width: traceState.preferences.list.width},
      span_list: {width: 1 - traceState.preferences.list.width},
    });
    // We only care about initial state when we initialize the view manager
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initialize the tabs reducer when the tree initializes
  useLayoutEffect(() => {
    return traceDispatch({
      type: 'set roving count',
      items: tree.list.length - 1,
    });
  }, [tree.list.length, traceDispatch]);

  // Initialize the tabs reducer when the tree initializes
  useLayoutEffect(() => {
    if (tree.type !== 'trace') {
      return;
    }

    const newTabs = [TRACE_TAB];

    if (tree.vitals.size > 0) {
      const types = Array.from(tree.vital_types.values());
      const label = types.length > 1 ? t('Vitals') : capitalize(types[0]) + ' Vitals';

      newTabs.push({
        ...VITALS_TAB,
        label,
      });
    }

    if (tree.profiled_events.size > 0) {
      newTabs.push({
        node: 'profiles',
        label: 'Profiles',
      });
    }

    traceDispatch({
      type: 'initialize tabs reducer',
      payload: {
        current_tab: traceStateRef?.current?.tabs?.tabs?.[0],
        tabs: newTabs,
        last_clicked_tab: null,
      },
    });
    // We only want to update the tabs when the tree changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree]);

  useLayoutEffect(() => {
    const queryParams = qs.parse(location.search);
    const maybeQueue = decodeScrollQueue(queryParams.node);

    if (maybeQueue || queryParams.eventId) {
      scrollQueueRef.current = {
        eventId: queryParams.eventId as string,
        path: maybeQueue as TraceTreeNode<TraceTree.NodeValue>['path'],
      };
    }
  }, [tree]);

  const searchingRaf = useRef<{id: number | null} | null>(null);
  const onTraceSearch = useCallback(
    (
      query: string,
      activeNode: TraceTreeNode<TraceTree.NodeValue> | null,
      behavior: 'track result' | 'persist'
    ) => {
      if (searchingRaf.current?.id) {
        window.cancelAnimationFrame(searchingRaf.current.id);
      }

      searchingRaf.current = searchInTraceTree(
        tree,
        query,
        activeNode,
        ([matches, lookup, activeNodeSearchResult]) => {
          // If the previous node is still in the results set, we want to keep it
          if (activeNodeSearchResult) {
            traceDispatch({
              type: 'set results',
              results: matches,
              resultsLookup: lookup,
              resultIteratorIndex: activeNodeSearchResult?.resultIteratorIndex,
              resultIndex: activeNodeSearchResult?.resultIndex,
              previousNode: activeNodeSearchResult,
              node: activeNode,
            });
            return;
          }

          if (activeNode && behavior === 'persist') {
            traceDispatch({
              type: 'set results',
              results: matches,
              resultsLookup: lookup,
              resultIteratorIndex: undefined,
              resultIndex: undefined,
              previousNode: activeNodeSearchResult,
              node: activeNode,
            });
            return;
          }

          const resultIndex: number | undefined = matches?.[0]?.index;
          const resultIteratorIndex: number | undefined = matches?.[0] ? 0 : undefined;
          const node: TraceTreeNode<TraceTree.NodeValue> | null = matches?.[0]?.value;
          traceDispatch({
            type: 'set results',
            results: matches,
            resultsLookup: lookup,
            resultIteratorIndex: resultIteratorIndex,
            resultIndex: resultIndex,
            previousNode: activeNodeSearchResult,
            node,
          });
        }
      );
    },
    [traceDispatch, tree]
  );

  // We need to heavily debounce query string updates because the rest of the app is so slow
  // to rerender that it causes the search to drop frames on every keystroke...
  const QUERY_STRING_STATE_DEBOUNCE = 300;
  const queryStringAnimationTimeoutRef = useRef<{id: number} | null>(null);
  const setRowAsFocused = useCallback(
    (
      node: TraceTreeNode<TraceTree.NodeValue> | null,
      event: React.MouseEvent<HTMLElement> | null,
      resultsLookup: Map<TraceTreeNode<TraceTree.NodeValue>, number>,
      index: number | null,
      debounce: number = QUERY_STRING_STATE_DEBOUNCE
    ) => {
      // sync query string with the clicked node
      if (node) {
        if (queryStringAnimationTimeoutRef.current) {
          cancelAnimationTimeout(queryStringAnimationTimeoutRef.current);
        }
        queryStringAnimationTimeoutRef.current = requestAnimationTimeout(() => {
          const currentQueryStringPath = qs.parse(location.search).node;
          const nextNodePath = node.path;
          // Updating the query string with the same path is problematic because it causes
          // the entire sentry app to rerender, which is enough to cause jank and drop frames
          if (JSON.stringify(currentQueryStringPath) === JSON.stringify(nextNodePath)) {
            return;
          }
          const {eventId: _eventId, ...query} = qs.parse(location.search);
          browserHistory.replace({
            pathname: location.pathname,
            query: {
              ...query,
              node: nextNodePath,
            },
          });
          queryStringAnimationTimeoutRef.current = null;
        }, debounce);

        if (resultsLookup.has(node) && typeof index === 'number') {
          traceDispatch({
            type: 'set search iterator index',
            resultIndex: index,
            resultIteratorIndex: resultsLookup.get(node)!,
          });
        }

        if (isTraceNode(node)) {
          traceDispatch({type: 'activate tab', payload: TRACE_TAB.node});
          return;
        }

        traceDispatch({
          type: 'activate tab',
          payload: node,
          pin_previous: event?.metaKey,
        });
      }
    },
    [traceDispatch]
  );

  const onRowClick = useCallback(
    (
      node: TraceTreeNode<TraceTree.NodeValue>,
      event: React.MouseEvent<HTMLElement>,
      index: number
    ) => {
      if (traceStateRef.current.preferences.drawer.minimized) {
        traceDispatch({type: 'minimize drawer', payload: false});
      }
      setRowAsFocused(node, event, traceStateRef.current.search.resultsLookup, null, 0);

      if (traceStateRef.current.search.resultsLookup.has(node)) {
        const idx = traceStateRef.current.search.resultsLookup.get(node)!;
        traceDispatch({
          type: 'set search iterator index',
          resultIndex: index,
          resultIteratorIndex: idx,
        });
      } else if (traceStateRef.current.search.resultIteratorIndex !== null) {
        traceDispatch({type: 'clear search iterator index'});
      }

      traceDispatch({
        type: 'set roving index',
        action_source: 'click',
        index,
        node,
      });
    },
    [setRowAsFocused, traceDispatch]
  );

  const scrollRowIntoView = useCallback(
    (
      node: TraceTreeNode<TraceTree.NodeValue>,
      index: number,
      anchor?: ViewManagerScrollAnchor,
      force?: boolean
    ) => {
      // Last node we scrolled to is the same as the node we want to scroll to
      if (previouslyScrolledToNodeRef.current === node && !force) {
        return;
      }

      // Always scroll to the row vertically
      viewManager.scrollToRow(index, anchor);
      previouslyScrolledToNodeRef.current = node;

      // If the row had not yet been measured, then enqueue a listener for when
      // the row is rendered and measured. This ensures that horizontal scroll
      // accurately narrows zooms to the start of the node as the new width will be updated
      if (!viewManager.row_measurer.cache.has(node)) {
        viewManager.row_measurer.once('row measure end', () => {
          if (!viewManager.isOutsideOfViewOnKeyDown(node)) {
            return;
          }
          viewManager.scrollRowIntoViewHorizontally(node, 0, 48, 'measured');
        });
      } else {
        if (!viewManager.isOutsideOfViewOnKeyDown(node)) {
          return;
        }
        viewManager.scrollRowIntoViewHorizontally(node, 0, 48, 'measured');
      }
    },
    [viewManager]
  );

  const onTabScrollToNode = useCallback(
    (node: TraceTreeNode<TraceTree.NodeValue>) => {
      if (node === null) {
        return;
      }

      // We call expandToNode because we want to ensure that the node is
      // visible and may not have been collapsed/hidden by the user
      TraceTree.ExpandToPath(tree, node.path, rerender, {
        api,
        organization,
      }).then(maybeNode => {
        if (maybeNode) {
          previouslyFocusedNodeRef.current = null;
          scrollRowIntoView(maybeNode.node, maybeNode.index, 'center if outside', true);
          traceDispatch({
            type: 'set roving index',
            node: maybeNode.node,
            index: maybeNode.index,
            action_source: 'click',
          });
          setRowAsFocused(
            maybeNode.node,
            null,
            traceStateRef.current.search.resultsLookup,
            null,
            0
          );

          if (traceStateRef.current.search.resultsLookup.has(maybeNode.node)) {
            traceDispatch({
              type: 'set search iterator index',
              resultIndex: maybeNode.index,
              resultIteratorIndex: traceStateRef.current.search.resultsLookup.get(
                maybeNode.node
              )!,
            });
          } else if (traceStateRef.current.search.resultIteratorIndex !== null) {
            traceDispatch({type: 'clear search iterator index'});
          }
        }
      });
    },
    [api, organization, setRowAsFocused, scrollRowIntoView, tree, traceDispatch]
  );

  // Unlike onTabScrollToNode, this function does not set the node as the current
  // focused node, but rather scrolls the node into view and sets the roving index to the node.
  const onScrollToNode = useCallback(
    (node: TraceTreeNode<TraceTree.NodeValue>) => {
      TraceTree.ExpandToPath(tree, node.path, rerender, {
        api,
        organization,
      }).then(maybeNode => {
        if (maybeNode) {
          previouslyFocusedNodeRef.current = null;
          scrollRowIntoView(maybeNode.node, maybeNode.index, 'center if outside', true);
          traceDispatch({
            type: 'set roving index',
            node: maybeNode.node,
            index: maybeNode.index,
            action_source: 'click',
          });

          if (traceStateRef.current.search.resultsLookup.has(maybeNode.node)) {
            traceDispatch({
              type: 'set search iterator index',
              resultIndex: maybeNode.index,
              resultIteratorIndex: traceStateRef.current.search.resultsLookup.get(
                maybeNode.node
              )!,
            });
          } else if (traceStateRef.current.search.resultIteratorIndex !== null) {
            traceDispatch({type: 'clear search iterator index'});
          }
        }
      });
    },
    [api, organization, scrollRowIntoView, tree, traceDispatch]
  );

  // Callback that is invoked when the trace loads and reaches its initialied state,
  // that is when the trace tree data and any data that the trace depends on is loaded,
  // but the trace is not yet rendered in the view.
  const onTraceLoad = useCallback(
    (
      _trace: TraceTree,
      nodeToScrollTo: TraceTreeNode<TraceTree.NodeValue> | null,
      indexOfNodeToScrollTo: number | null
    ) => {
      scrollQueueRef.current = null;
      const query = qs.parse(location.search);

      if (query.fov && typeof query.fov === 'string') {
        viewManager.maybeInitializeTraceViewFromQS(query.fov);
      }

      if (nodeToScrollTo !== null && indexOfNodeToScrollTo !== null) {
        viewManager.scrollToRow(indexOfNodeToScrollTo, 'center');

        // At load time, we want to scroll the row into view, but we need to ensure
        // that the row had been measured first, else we can exceed the bounds of the container.
        scrollRowIntoView(nodeToScrollTo, indexOfNodeToScrollTo, 'center');

        setRowAsFocused(
          nodeToScrollTo,
          null,
          traceStateRef.current.search.resultsLookup,
          indexOfNodeToScrollTo
        );
        traceDispatch({
          type: 'set roving index',
          node: nodeToScrollTo,
          index: indexOfNodeToScrollTo,
          action_source: 'load',
        });
      }

      if (traceStateRef.current.search.query) {
        onTraceSearch(traceStateRef.current.search.query, nodeToScrollTo, 'persist');
      }
    },
    [setRowAsFocused, traceDispatch, onTraceSearch, scrollRowIntoView, viewManager]
  );

  // Setup the middleware for the trace reducer
  useLayoutEffect(() => {
    const beforeTraceNextStateDispatch: DispatchingReducerMiddleware<
      typeof TraceReducer
    >['before next state'] = (prevState, nextState, action) => {
      // This effect is responsible fo syncing the keyboard interactions with the search results,
      // we observe the changes to the roving tab index and search results and react by syncing the state.
      const {node: nextRovingNode, index: nextRovingTabIndex} = nextState.rovingTabIndex;
      const {resultIndex: nextSearchResultIndex} = nextState.search;
      if (
        nextRovingNode &&
        action.type === 'set roving index' &&
        action.action_source !== 'click' &&
        typeof nextRovingTabIndex === 'number' &&
        prevState.rovingTabIndex.node !== nextRovingNode
      ) {
        // When the roving tabIndex updates mark the node as focused and sync search results
        setRowAsFocused(
          nextRovingNode,
          null,
          nextState.search.resultsLookup,
          nextRovingTabIndex
        );
        if (action.type === 'set roving index' && action.action_source === 'keyboard') {
          scrollRowIntoView(nextRovingNode, nextRovingTabIndex, undefined);
        }

        if (nextState.search.resultsLookup.has(nextRovingNode)) {
          const idx = nextState.search.resultsLookup.get(nextRovingNode)!;
          traceDispatch({
            type: 'set search iterator index',
            resultIndex: nextRovingTabIndex,
            resultIteratorIndex: idx,
          });
        } else if (nextState.search.resultIteratorIndex !== null) {
          traceDispatch({type: 'clear search iterator index'});
        }
      } else if (
        typeof nextSearchResultIndex === 'number' &&
        prevState.search.resultIndex !== nextSearchResultIndex &&
        action.type !== 'set search iterator index'
      ) {
        // If the search result index changes, mark the node as focused and scroll it into view
        const nextNode = tree.list[nextSearchResultIndex];
        setRowAsFocused(
          nextNode,
          null,
          nextState.search.resultsLookup,
          nextSearchResultIndex
        );
        scrollRowIntoView(nextNode, nextSearchResultIndex, 'center if outside');
      }
    };

    traceStateEmitter.on('before next state', beforeTraceNextStateDispatch);

    return () => {
      traceStateEmitter.off('before next state', beforeTraceNextStateDispatch);
    };
  }, [
    tree,
    onTraceSearch,
    traceStateEmitter,
    traceDispatch,
    setRowAsFocused,
    scrollRowIntoView,
  ]);

  // Setup the middleware for the view manager and store the list width as a preference
  useLayoutEffect(() => {
    function onDividerResizeEnd(list_width: number) {
      traceDispatch({
        type: 'set list width',
        payload: list_width,
      });
    }
    viewManager.on('divider resize end', onDividerResizeEnd);
    return () => {
      viewManager.off('divider resize end', onDividerResizeEnd);
    };
  }, [viewManager, traceDispatch]);

  // Sync part of the state with the URL
  const traceQueryStateSync = useMemo(() => {
    return {search: traceState.search.query};
  }, [traceState.search.query]);

  useTraceQueryParamStateSync(traceQueryStateSync);
  useLayoutEffect(() => {
    storeTraceViewPreferences(traceState.preferences);
  }, [traceState.preferences]);

  const [traceGridRef, setTraceGridRef] = useState<HTMLElement | null>(null);

  // Memoized because it requires tree traversal
  const shape = useMemo(() => tree.shape, [tree]);

  useEffect(() => {
    if (tree.type !== 'trace') {
      return;
    }

    logTraceType(shape, organization);
  }, [tree, shape, organization]);

  useLayoutEffect(() => {
    if (!tree.root?.space || tree.type !== 'trace') {
      return undefined;
    }

    initializedRef.current = true;
    viewManager.initializeTraceSpace([tree.root.space[0], 0, tree.root.space[1], 1]);

    // Whenever the timeline changes, update the trace space
    const onTraceTimelineChange = (s: [number, number]) => {
      viewManager.updateTraceSpace(s[0], s[1]);
    };

    tree.on('trace timeline change', onTraceTimelineChange);

    return () => {
      tree.off('trace timeline change', onTraceTimelineChange);
    };
  }, [viewManager, tree]);

  return (
    <TraceExternalLayout>
      <TraceUXChangeAlert />
      <TraceMetadataHeader
        organization={props.organization}
        projectID={rootEvent?.data?.projectID ?? ''}
        title={rootEvent?.data?.title ?? ''}
        traceSlug={props.traceSlug}
        traceEventView={props.traceEventView}
      />
      <TraceInnerLayout>
        <TraceToolbar>
          <TraceSearchInput
            trace_state={traceState}
            trace_dispatch={traceDispatch}
            onTraceSearch={onTraceSearch}
          />
          <TraceResetZoomButton viewManager={viewManager} organization={organization} />
          <TraceShortcuts />
        </TraceToolbar>
        <TraceGrid layout={traceState.preferences.layout} ref={setTraceGridRef}>
          <Trace
            trace={tree}
            rerender={rerender}
            trace_id={props.traceSlug}
            trace_state={traceState}
            trace_dispatch={traceDispatch}
            scrollQueueRef={scrollQueueRef}
            initializedRef={initializedRef}
            onRowClick={onRowClick}
            onTraceLoad={onTraceLoad}
            onTraceSearch={onTraceSearch}
            previouslyFocusedNodeRef={previouslyFocusedNodeRef}
            manager={viewManager}
            forceRerender={forceRender}
          />

          {tree.type === 'error' ? (
            <TraceError />
          ) : tree.type === 'empty' ? (
            <TraceEmpty />
          ) : tree.type === 'loading' || scrollQueueRef.current ? (
            <TraceLoading />
          ) : null}

          <TraceDrawer
            metaResults={props.metaResults}
            traceType={shape}
            trace={tree}
            traceGridRef={traceGridRef}
            traces={props.trace}
            manager={viewManager}
            trace_state={traceState}
            trace_dispatch={traceDispatch}
            onTabScrollToNode={onTabScrollToNode}
            onScrollToNode={onScrollToNode}
            rootEventResults={rootEvent}
            traceEventView={props.traceEventView}
          />
        </TraceGrid>
      </TraceInnerLayout>
    </TraceExternalLayout>
  );
}

function TraceResetZoomButton(props: {
  organization: Organization;
  viewManager: VirtualizedViewManager;
}) {
  const onResetZoom = useCallback(() => {
    traceAnalytics.trackResetZoom(props.organization);
    props.viewManager.resetZoom();
  }, [props.viewManager, props.organization]);

  return (
    <ResetZoomButton
      size="xs"
      onClick={onResetZoom}
      ref={props.viewManager.registerResetZoomRef}
    >
      {t('Reset Zoom')}
    </ResetZoomButton>
  );
}

const ResetZoomButton = styled(Button)`
  transition: opacity 0.2s 0.5s ease-in-out;

  &[disabled] {
    cursor: not-allowed;
    opacity: 0.65;
  }
`;

const TraceExternalLayout = styled('div')`
  display: flex;
  flex-direction: column;
  flex: 1 1 100%;

  ~ footer {
    display: none;
  }
`;

const TraceInnerLayout = styled('div')`
  display: flex;
  flex-direction: column;
  flex: 1 1 100%;
  padding: ${space(2)};

  background-color: ${p => p.theme.background};

  --info: ${p => p.theme.purple400};
  --warning: ${p => p.theme.yellow300};
  --error: ${p => p.theme.error};
  --fatal: ${p => p.theme.error};
  --default: ${p => p.theme.gray300};
  --unknown: ${p => p.theme.gray300};
  --profile: ${p => p.theme.purple300};
  --autogrouped: ${p => p.theme.blue300};
  --performance-issue: ${p => p.theme.blue300};
`;

const TraceToolbar = styled('div')`
  flex-grow: 0;
  display: grid;
  grid-template-columns: 1fr min-content min-content;
  gap: ${space(1)};
`;

const TraceGrid = styled('div')<{
  layout: 'drawer bottom' | 'drawer left' | 'drawer right';
}>`
  box-shadow: 0 0 0 1px ${p => p.theme.border};
  flex: 1 1 100%;
  display: grid;
  border-radius: ${p => p.theme.borderRadius};
  overflow: hidden;
  position: relative;
  /* false positive for grid layout */
  /* stylelint-disable */
  grid-template-areas: ${p =>
    p.layout === 'drawer bottom'
      ? `
      'trace'
      'drawer'
      `
      : p.layout === 'drawer left'
        ? `'drawer trace'`
        : `'trace drawer'`};
  grid-template-columns: ${p =>
    p.layout === 'drawer bottom'
      ? '1fr'
      : p.layout === 'drawer left'
        ? 'min-content 1fr'
        : '1fr min-content'};
  grid-template-rows: 1fr auto;
`;

const LoadingContainer = styled('div')<{animate: boolean; error?: boolean}>`
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  left: 50%;
  top: 50%;
  position: absolute;
  height: auto;
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.gray300};
  z-index: 30;
  padding: 24px;
  background-color: ${p => p.theme.background};
  border-radius: ${p => p.theme.borderRadius};
  border: 1px solid ${p => p.theme.border};
  transform-origin: 50% 50%;
  transform: translate(-50%, -50%);
  animation: ${p =>
    p.animate
      ? `${p.error ? 'showLoadingContainerShake' : 'showLoadingContainer'} 300ms cubic-bezier(0.61, 1, 0.88, 1) forwards`
      : 'none'};

  @keyframes showLoadingContainer {
    from {
      opacity: 0.6;
      transform: scale(0.99) translate(-50%, -50%);
    }
    to {
      opacity: 1;
      transform: scale(1) translate(-50%, -50%);
    }
  }

  @keyframes showLoadingContainerShake {
    0% {
      transform: translate(-50%, -50%);
    }
    25% {
      transform: translate(-51%, -50%);
    }
    75% {
      transform: translate(-49%, -50%);
    }
    100% {
      transform: translate(-50%, -50%);
    }
  }
`;

function TraceLoading() {
  return (
    // Dont flash the animation on load because it's annoying
    <LoadingContainer animate={false}>
      <NoMarginIndicator size={24}>
        <div>{t('Assembling the trace')}</div>
      </NoMarginIndicator>
    </LoadingContainer>
  );
}

function TraceError() {
  const linkref = useRef<HTMLAnchorElement>(null);
  const feedback = useFeedbackWidget({buttonRef: linkref});

  useEffect(() => {
    traceAnalytics.trackFailedToFetchTraceState();
  }, []);

  return (
    <LoadingContainer animate error>
      <div>{t('Ughhhhh, we failed to load your trace...')}</div>
      <div>
        {t('Seeing this often? Send us ')}
        {feedback ? (
          <a href="#" ref={linkref}>
            {t('feedback')}
          </a>
        ) : (
          <a href="mailto:support@sentry.io?subject=Trace%20fails%20to%20load">
            {t('feedback')}
          </a>
        )}
      </div>
    </LoadingContainer>
  );
}

function TraceEmpty() {
  const linkref = useRef<HTMLAnchorElement>(null);
  const feedback = useFeedbackWidget({buttonRef: linkref});

  useEffect(() => {
    traceAnalytics.trackEmptyTraceState();
  }, []);

  return (
    <LoadingContainer animate>
      <div>{t('This trace does not contain any data?!')}</div>
      <div>
        {t('Seeing this often? Send us ')}
        {feedback ? (
          <a href="#" ref={linkref}>
            {t('feedback')}
          </a>
        ) : (
          <a href="mailto:support@sentry.io?subject=Trace%20does%20not%20contain%20data">
            {t('feedback')}
          </a>
        )}
      </div>
    </LoadingContainer>
  );
}

const NoMarginIndicator = styled(LoadingIndicator)`
  margin: 0;
`;
