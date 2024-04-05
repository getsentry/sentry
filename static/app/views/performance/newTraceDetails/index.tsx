import type React from 'react';
import {useCallback, useLayoutEffect, useMemo, useReducer, useRef} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import {Button} from 'sentry/components/button';
import useFeedbackWidget from 'sentry/components/feedback/widget/useFeedbackWidget';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import type {
  TraceFullDetailed,
  TraceMeta,
  TraceSplitResults,
} from 'sentry/utils/performance/quickTrace/types';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import {capitalize} from 'sentry/utils/string/capitalize';
import {
  type DispatchingReducerMiddleware,
  useDispatchingReducer,
} from 'sentry/utils/useDispatchingReducer';
import useOnClickOutside from 'sentry/utils/useOnClickOutside';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import useProjects from 'sentry/utils/useProjects';

import {useTrace} from './traceApi/useTrace';
import {useTraceMeta} from './traceApi/useTraceMeta';
import {useTraceRootEvent} from './traceApi/useTraceRootEvent';
import {TraceDrawer} from './traceDrawer/traceDrawer';
import {TraceSearchInput} from './traceSearch/traceSearchInput';
import {searchInTraceTree} from './traceState/traceSearch';
import {isTraceNode} from './guards';
import {Trace} from './trace';
import {TraceHeader} from './traceHeader';
import {TraceMetadataHeader} from './traceMetadataHeader';
import {TraceReducer, type TraceReducerState} from './traceState';
import {TraceTree, type TraceTreeNode} from './traceTree';
import {TraceUXChangeAlert} from './traceUXChangeBanner';
import {useTraceQueryParamStateSync} from './useTraceQueryParamStateSync';
import {VirtualizedViewManager} from './virtualizedViewManager';

export function TraceView() {
  const params = useParams<{traceSlug?: string}>();
  const organization = useOrganization();

  const traceSlug = useMemo(() => params.traceSlug?.trim() ?? '', [params.traceSlug]);
  const queryParams = useMemo(() => {
    const normalizedParams = normalizeDateTimeParams(qs.parse(location.search), {
      allowAbsolutePageDatetime: true,
    });
    const start = decodeScalar(normalizedParams.start);
    const end = decodeScalar(normalizedParams.end);
    const statsPeriod = decodeScalar(normalizedParams.statsPeriod);

    return {start, end, statsPeriod, useSpans: 1};
  }, []);

  const traceEventView = useMemo(() => {
    const {start, end, statsPeriod} = queryParams;

    return EventView.fromSavedQuery({
      id: undefined,
      name: `Events with Trace ID ${traceSlug}`,
      fields: ['title', 'event.type', 'project', 'timestamp'],
      orderby: '-timestamp',
      query: `trace:${traceSlug}`,
      projects: [ALL_ACCESS_PROJECTS],
      version: 2,
      start,
      end,
      range: statsPeriod,
    });
  }, [queryParams, traceSlug]);

  const trace = useTrace();
  const meta = useTraceMeta();

  return (
    <SentryDocumentTitle title={t('Trace')} orgSlug={organization.slug}>
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
  const {projects} = useProjects();
  const rootEvent = useTraceRootEvent(props.trace);
  const loadingTraceRef = useRef<TraceTree | null>(null);
  const [forceRender, rerender] = useReducer(x => x + (1 % 2), 0);
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

  const [traceState, traceDispatch, traceStateEmitter] = useDispatchingReducer(
    TraceReducer,
    {
      rovingTabIndex: {
        index: null,
        items: null,
        node: null,
      },
      search: {
        query: initialQuery,
        resultIteratorIndex: null,
        resultIndex: null,
        results: null,
        status: undefined,
        resultsLookup: new Map(),
      },
      preferences: {
        list: {width: 0.5},
        layout: 'drawer bottom',
        drawer: {
          minimized: false,
          sizes: {['drawer bottom']: 0.3},
        },
      },
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
      type: 'initialize roving reducer',
      items: tree.list.length - 1,
      index: null,
      node: null,
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

  const searchingRaf = useRef<{id: number | null} | null>(null);
  const onTraceSearch = useCallback(
    (query: string) => {
      if (searchingRaf.current?.id) {
        window.cancelAnimationFrame(searchingRaf.current.id);
      }

      const previousNode = traceStateRef.current.rovingTabIndex.node;

      searchingRaf.current = searchInTraceTree(
        tree,
        query,
        previousNode,
        ([matches, lookup, previousNodePosition]) => {
          // If the user had focused a row, clear it and focus into the search result.
          if (traceStateRef.current.rovingTabIndex.index !== null) {
            traceDispatch({type: 'clear roving index'});
          }

          const resultIteratorIndex: number | undefined =
            typeof previousNodePosition?.resultIteratorIndex === 'number'
              ? previousNodePosition.resultIteratorIndex
              : matches.length > 0
                ? 0
                : undefined;

          const resultIndex: number | undefined =
            typeof previousNodePosition?.resultIndex === 'number'
              ? previousNodePosition.resultIndex
              : matches.length > 0
                ? matches[0].index
                : undefined;

          traceDispatch({
            type: 'set results',
            results: matches,
            resultsLookup: lookup,
            resultIteratorIndex: resultIteratorIndex,
            resultIndex: resultIndex,
          });
        }
      );
    },
    [traceDispatch, tree]
  );

  const onRowClick = useCallback(
    (
      node: TraceTreeNode<TraceTree.NodeValue> | null,
      event: React.MouseEvent<HTMLElement> | null,
      index: number | null
    ) => {
      // Sync qs with the clicked node
      if (node) {
        previouslyFocusedNodeRef.current = node;
        const {eventId: _eventId, ...query} = qs.parse(location.search);
        browserHistory.replace({
          pathname: location.pathname,
          query: {
            ...query,
            node: node.path,
          },
        });
      }

      if (node && typeof index === 'number') {
        traceDispatch({
          type: 'set roving index',
          index: index,
          node: node,
        });
      }
      if (!node) {
        traceDispatch({type: 'clear clicked tab'});
        return;
      }

      if (isTraceNode(node)) {
        traceDispatch({type: 'activate tab', payload: TRACE_TAB.node});
        return;
      }

      traceDispatch({type: 'activate tab', payload: node, pin_previous: event?.metaKey});
    },

    [traceDispatch]
  );

  // Scrolls to row in trace view
  const onScrollRowIntoView = useCallback(
    (node: TraceTreeNode<TraceTree.NodeValue>, index?: number, anchor?: 'top') => {
      if (index === undefined) {
        index = tree.list.indexOf(node);
      }

      // @TODO we usually know this at render time, we should not have to search for it
      if (index === -1) {
        return;
      }

      viewManager.scrollToRow(index, anchor);

      const offset =
        node.depth >= (previouslyScrolledToNodeRef.current?.depth ?? 0)
          ? viewManager.trace_physical_space.width / 2
          : 0;

      previouslyScrolledToNodeRef.current = node;

      if (viewManager.isOutsideOfViewOnKeyDown(node, offset)) {
        viewManager.scrollRowIntoViewHorizontally(node, 0, offset, 'measured');
      }

      viewManager.onScrollEndOutOfBoundsCheck();
    },
    [tree, viewManager]
  );

  const onTraceLoad = useCallback(
    (
      _trace: TraceTree,
      node: TraceTreeNode<TraceTree.NodeValue> | null,
      index: number | null
    ) => {
      // If the trace loaded with a node that we should scroll to,
      // scroll to it and mark it as clicked
      if (node && index) {
        onScrollRowIntoView(node, index, 'top');
        onRowClick(node, null, index);
      }
    },
    [onRowClick, onScrollRowIntoView]
  );

  // Setup the middleware for the trace reducer
  useLayoutEffect(() => {
    const beforeTraceAction: DispatchingReducerMiddleware<
      typeof TraceReducer
    >['before action'] = (_state, action) => {
      const query = action.type === 'set query' ? action.query : undefined;
      if (action.type === 'set query' && query) {
        onTraceSearch(query);
      }
    };

    const beforeTraceNextStateDispatch: DispatchingReducerMiddleware<
      typeof TraceReducer
    >['before next state'] = (prevState, nextState, _action) => {
      // If eithef of the focused nodes that the user had clicked on is changing
      // as a result of a user action that is not a click, scroll that row into view
      // console.log('Before next state', 'previous', prevState, 'next', nextState, action);
      const {node: nextRovingNode, index: nextRovingTabIndex} = nextState.rovingTabIndex;
      if (
        nextRovingNode &&
        typeof nextRovingTabIndex === 'number' &&
        prevState.rovingTabIndex.node !== nextRovingNode
      ) {
        onScrollRowIntoView(nextRovingNode, nextRovingTabIndex);

        if (nextState.search.resultsLookup.has(tree.list[nextRovingTabIndex])) {
          const idx = traceStateRef.current.search.resultsLookup.get(nextRovingNode)!;

          traceDispatch({
            type: 'set search iterator index',
            resultIndex: nextRovingTabIndex,
            resultIteratorIndex: idx,
          });
        } else if (nextState.search.resultIteratorIndex !== null) {
          traceDispatch({type: 'clear search iterator index'});
        }
      }
    };

    traceStateEmitter.on('before action', beforeTraceAction);
    traceStateEmitter.on('before next state', beforeTraceNextStateDispatch);

    return () => {
      traceStateEmitter.off('before action', beforeTraceAction);
      traceStateEmitter.off('before next state', beforeTraceNextStateDispatch);
    };
  }, [tree, onTraceSearch, traceStateEmitter, traceDispatch, onScrollRowIntoView]);

  // Setup the middleware for the view manager
  useLayoutEffect(() => {
    function onDividerResizeEnd(_list_width: number) {
      // @TODO store this on state
    }
    viewManager.on('divider resize end', onDividerResizeEnd);

    return () => {
      viewManager.off('divider resize end', onDividerResizeEnd);
    };
  }, [viewManager]);

  // Sync part of the state with the URL
  const traceQueryStateSync = useMemo(() => {
    return {search: traceState.search.query};
  }, [traceState.search.query]);
  useTraceQueryParamStateSync(traceQueryStateSync);

  // Setup outside click handler so that we can clear the currently clicked node
  const onOutsideTraceContainerClick = useCallback(() => {
    if (tree.type !== 'trace') {
      // Dont clear the URL in case the trace is still loading or failed for some reason,
      // we want to keep the eventId in the URL so the user can share the URL with support
      return;
    }
    // we will drop eventId such that after users clicks outside and shares the URL
    const {
      node: _node,
      eventId: _eventId,
      ...queryParamsWithoutNode
    } = qs.parse(location.search);

    browserHistory.push({
      pathname: location.pathname,
      query: queryParamsWithoutNode,
    });

    traceDispatch({type: 'clear'});
  }, [tree, traceDispatch]);

  const traceContainerRef = useRef<HTMLElement | null>(null);
  useOnClickOutside(traceContainerRef, onOutsideTraceContainerClick);

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
        <TraceHeader
          tree={tree}
          rootEventResults={rootEvent}
          metaResults={props.metaResults}
          organization={props.organization}
          traces={props.trace}
          traceID={props.traceSlug}
        />
        <TraceToolbar>
          <TraceSearchInput trace_dispatch={traceDispatch} trace_state={traceState} />
          <TraceResetZoomButton viewManager={viewManager} />
        </TraceToolbar>
        <TraceGrid
          layout={traceState.preferences.layout}
          ref={r => (traceContainerRef.current = r)}
        >
          <Trace
            trace={tree}
            rerender={rerender}
            trace_id={props.traceSlug}
            trace_state={traceState}
            trace_dispatch={traceDispatch}
            scrollQueueRef={scrollQueueRef}
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
            trace={tree}
            traces={props.trace}
            manager={viewManager}
            onScrollToNode={onScrollRowIntoView}
            trace_state={traceState}
            trace_dispatch={traceDispatch}
            rootEventResults={rootEvent}
            traceEventView={props.traceEventView}
          />
        </TraceGrid>
      </TraceInnerLayout>
    </TraceExternalLayout>
  );
}

function TraceResetZoomButton(props: {viewManager: VirtualizedViewManager}) {
  return (
    <Button size="xs" onClick={props.viewManager.resetZoom}>
      {t('Reset Zoom')}
    </Button>
  );
}

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
  padding: ${space(2)} ${space(2)} 0 ${space(2)};
  background-color: ${p => p.theme.background};
`;

const TraceToolbar = styled('div')`
  flex-grow: 0;
  display: grid;
  grid-template-columns: 1fr min-content;
  gap: ${space(1)};
`;

const TraceGrid = styled('div')<{
  layout: 'drawer bottom' | 'drawer left' | 'drawer right';
}>`
  box-shadow: 0 0 0 1px ${p => p.theme.border};
  flex: 1 1 100%;
  display: grid;
  border-top-left-radius: ${p => p.theme.borderRadius};
  border-top-right-radius: ${p => p.theme.borderRadius};
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
