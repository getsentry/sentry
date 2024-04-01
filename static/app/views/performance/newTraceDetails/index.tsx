import type React from 'react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import Alert from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import DiscoverButton from 'sentry/components/discoverButton';
import useFeedbackWidget from 'sentry/components/feedback/widget/useFeedbackWidget';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {IconClose} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {EventTransaction, Organization} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import EventView from 'sentry/utils/discover/eventView';
import type {
  TraceFullDetailed,
  TraceMeta,
  TraceSplitResults,
} from 'sentry/utils/performance/quickTrace/types';
import {useApiQuery, type UseApiQueryResult} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import useApi from 'sentry/utils/useApi';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useLocation} from 'sentry/utils/useLocation';
import useOnClickOutside from 'sentry/utils/useOnClickOutside';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import useProjects from 'sentry/utils/useProjects';
import {
  rovingTabIndexReducer,
  type RovingTabIndexState,
} from 'sentry/views/performance/newTraceDetails/rovingTabIndex';
import {
  searchInTraceTree,
  traceSearchReducer,
  type TraceSearchState,
} from 'sentry/views/performance/newTraceDetails/traceSearch';
import {TraceSearchInput} from 'sentry/views/performance/newTraceDetails/traceSearchInput';
import {
  traceTabsReducer,
  type TraceTabsReducerState,
} from 'sentry/views/performance/newTraceDetails/traceTabs';
import {VirtualizedViewManager} from 'sentry/views/performance/newTraceDetails/virtualizedViewManager';

import {
  cancelAnimationTimeout,
  requestAnimationTimeout,
} from '../../../utils/profiling/hooks/useVirtualizedTree/virtualizedTreeUtils';
import Breadcrumb from '../breadcrumb';

import {TraceDrawer} from './traceDrawer/traceDrawer';
import {isTraceNode} from './guards';
import {Trace} from './trace';
import {TraceHeader} from './traceHeader';
import {TraceTree, type TraceTreeNode} from './traceTree';
import {useTrace} from './useTrace';
import {useTraceMeta} from './useTraceMeta';

const DOCUMENT_TITLE = [t('Trace')].join(' — ');

function maybeFocusRow() {
  const focused_node = document.querySelector(".TraceRow[tabIndex='0']");

  if (
    focused_node &&
    'focus' in focused_node &&
    typeof focused_node.focus === 'function'
  ) {
    focused_node.focus();
  }
}

export function TraceView() {
  const organization = useOrganization();
  const params = useParams<{traceSlug?: string}>();

  const traceSlug = params.traceSlug?.trim() ?? '';

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
    <SentryDocumentTitle title={DOCUMENT_TITLE} orgSlug={organization.slug}>
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

const TRACE_TAB: TraceTabsReducerState['tabs'][0] = {
  node: 'Trace',
};
const STATIC_DRAWER_TABS: TraceTabsReducerState['tabs'] = [TRACE_TAB];

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
  const {projects} = useProjects();
  const rootEvent = useRootEvent(props.trace);

  const [tracePreferences, setTracePreferences] = useLocalStorageState<{
    drawer: number;
    layout: 'drawer right' | 'drawer bottom' | 'drawer left';
    list_width: number;
  }>('trace_preferences', {
    layout: 'drawer bottom',
    list_width: 0.66,
    drawer: 0,
  });

  const viewManager = useMemo(() => {
    return new VirtualizedViewManager({
      list: {width: tracePreferences.list_width},
      span_list: {width: 1 - tracePreferences.list_width},
    });
    // We only care about initial state when we initialize the view manager
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const previouslyFocusedNodeRef = useRef<TraceTreeNode<TraceTree.NodeValue> | null>(
    null
  );
  const previouslyScrolledToNodeRef = useRef<TraceTreeNode<TraceTree.NodeValue> | null>(
    null
  );

  useEffect(() => {
    function onDividerResizeEnd(list_width: number) {
      setTracePreferences(previousPreferences => {
        return {...previousPreferences, list_width};
      });
    }
    viewManager.on('divider resize end', onDividerResizeEnd);

    return () => {
      viewManager.off('divider resize end', onDividerResizeEnd);
    };
  }, [viewManager, setTracePreferences]);

  const loadingTraceRef = useRef<TraceTree | null>(null);
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

  const [rovingTabIndexState, rovingTabIndexDispatch] = useReducer(
    rovingTabIndexReducer,
    {
      index: null,
      items: null,
      node: null,
    }
  );

  const rovingTabIndexStateRef = useRef<RovingTabIndexState>(rovingTabIndexState);
  rovingTabIndexStateRef.current = rovingTabIndexState;

  useLayoutEffect(() => {
    return rovingTabIndexDispatch({
      type: 'initialize',
      items: tree.list.length - 1,
      index: null,
      node: null,
    });
  }, [tree.list.length]);

  const initialQuery = useMemo((): string | undefined => {
    const query = qs.parse(location.search);

    if (typeof query.search === 'string') {
      return query.search;
    }
    return undefined;
    // We only want to decode on load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [searchState, searchDispatch] = useReducer(traceSearchReducer, {
    query: initialQuery,
    resultIteratorIndex: null,
    resultIndex: null,
    node: null,
    results: null,
    status: undefined,
    resultsLookup: new Map(),
  });

  const searchStateRef = useRef<TraceSearchState>(searchState);
  searchStateRef.current = searchState;

  const [tabs, tabsDispatch] = useReducer(traceTabsReducer, {
    tabs: STATIC_DRAWER_TABS,
    current: STATIC_DRAWER_TABS[0] ?? null,
    last_clicked: null,
  });

  const onRowClick = useCallback(
    (
      node: TraceTreeNode<TraceTree.NodeValue> | null,
      event: React.MouseEvent<HTMLElement> | null
    ) => {
      if (!node) {
        tabsDispatch({type: 'clear clicked tab'});
        return;
      }

      if (isTraceNode(node)) {
        tabsDispatch({type: 'activate tab', payload: TRACE_TAB.node});
        maybeFocusRow();
        return;
      }

      tabsDispatch({type: 'activate tab', payload: node, pin_previous: event?.metaKey});
      maybeFocusRow();
    },
    []
  );

  const searchingRaf = useRef<{id: number | null} | null>(null);
  const onTraceSearch = useCallback(
    (
      traceTree: TraceTree,
      query: string,
      previouslySelectedNode: TraceTreeNode<TraceTree.NodeValue> | null
    ) => {
      if (searchingRaf.current?.id) {
        window.cancelAnimationFrame(searchingRaf.current.id);
      }

      searchingRaf.current = searchInTraceTree(
        traceTree,
        query,
        previouslySelectedNode,
        ([matches, lookup, previousNodePosition]) => {
          // If the user had focused a row, clear it and focus into the search result.
          if (rovingTabIndexStateRef.current.index !== null) {
            rovingTabIndexDispatch({type: 'clear index'});
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

          const node: TraceTreeNode<TraceTree.NodeValue> | null = previousNodePosition
            ? previouslySelectedNode
            : matches.length > 0
              ? matches[0].value
              : null;

          searchDispatch({
            type: 'set results',
            results: matches,
            resultsLookup: lookup,
            resultIteratorIndex: resultIteratorIndex,
            resultIndex: resultIndex,
            node,
          });
        }
      );
    },
    []
  );

  const onSearchChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (!event.currentTarget.value) {
        searchDispatch({type: 'clear query'});
        return;
      }

      const previousNode =
        rovingTabIndexStateRef.current.node ?? searchStateRef.current.node ?? null;

      searchDispatch({type: 'set query', query: event.currentTarget.value});
      onTraceSearch(tree, event.currentTarget.value, previousNode);
    },
    [onTraceSearch, tree]
  );

  const onSearchClear = useCallback(() => {
    searchDispatch({type: 'clear query'});
  }, []);

  const onSearchKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        searchDispatch({type: 'go to next match'});
        break;
      case 'ArrowUp':
        searchDispatch({type: 'go to previous match'});
        break;
      case 'Enter':
        searchDispatch({
          type: event.shiftKey ? 'go to previous match' : 'go to next match',
        });
        break;
      default:
    }
  }, []);

  const onNextSearchClick = useCallback(() => {
    searchDispatch({type: 'go to next match'});
  }, []);

  const onPreviousSearchClick = useCallback(() => {
    searchDispatch({type: 'go to previous match'});
  }, []);

  // This should be performed synchronously when reducer actions are dispatched
  useLayoutEffect(() => {
    if (searchState.node && typeof searchStateRef.current.resultIndex === 'number') {
      if (
        previouslyFocusedNodeRef.current === searchState.node ||
        previouslyScrolledToNodeRef.current === searchState.node
      ) {
        return;
      }

      onRowClick(searchState.node, null);
      viewManager.scrollToRow(searchStateRef.current.resultIndex);

      const offset =
        searchState.node.depth >= (previouslyScrolledToNodeRef.current?.depth ?? 0)
          ? viewManager.trace_physical_space.width / 2
          : 0;

      previouslyScrolledToNodeRef.current = searchState.node;

      if (viewManager.isOutsideOfViewOnKeyDown(searchState.node, offset)) {
        viewManager.scrollRowIntoViewHorizontally(
          searchState.node,
          0,
          offset,
          'measured'
        );
      }
    }
  }, [searchState.node, viewManager, onRowClick]);

  // This should be performed synchronously when reducer actions are dispatched
  useLayoutEffect(() => {
    if (
      rovingTabIndexState.node &&
      typeof rovingTabIndexStateRef.current.index === 'number'
    ) {
      if (previouslyScrolledToNodeRef.current === rovingTabIndexState.node) {
        return;
      }

      onRowClick(rovingTabIndexState.node, null);
      viewManager.scrollToRow(rovingTabIndexStateRef.current.index);

      const offset =
        rovingTabIndexState.node.depth >=
        (previouslyScrolledToNodeRef.current?.depth ?? 0)
          ? viewManager.trace_physical_space.width / 2
          : 0;

      previouslyScrolledToNodeRef.current = rovingTabIndexState.node;

      if (viewManager.isOutsideOfViewOnKeyDown(rovingTabIndexState.node, offset)) {
        viewManager.scrollRowIntoViewHorizontally(
          rovingTabIndexState.node,
          0,
          offset,
          'measured'
        );
      }
    }
  }, [rovingTabIndexState.node, viewManager, onRowClick]);

  const syncQuery = useMemo(() => {
    return {search: searchState.query};
  }, [searchState.query]);

  useQueryParamSync(syncQuery);

  const onOutsideClick = useCallback(() => {
    if (tree.type !== 'trace') {
      // Dont clear the URL in case the trace is still loading or failed for some reason,
      // we want to keep the eventId in the URL so the user can share the URL with support
      return;
    }
    // we will drop eventId such that after users clicks outside and shares the URL,
    // we will no longer scroll to the event or node
    const {
      node: _node,
      eventId: _eventId,
      ...queryParamsWithoutNode
    } = qs.parse(location.search);

    browserHistory.push({
      pathname: location.pathname,
      query: queryParamsWithoutNode,
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const traceContainerRef = useRef<HTMLElement | null>(null);
  useOnClickOutside(traceContainerRef, onOutsideClick);

  const scrollToNode = useCallback(
    (
      node: TraceTreeNode<TraceTree.NodeValue>
    ): Promise<{index: number; node: TraceTreeNode<TraceTree.NodeValue>} | null> => {
      return viewManager
        .scrollToPath(tree, [...node.path], () => void 0, {
          api,
          organization: props.organization,
        })
        .then(maybeNode => {
          previouslyScrolledToNodeRef.current = maybeNode?.node ?? null;

          if (!maybeNode) {
            return null;
          }

          viewManager.onScrollEndOutOfBoundsCheck();
          rovingTabIndexDispatch({
            type: 'set index',
            index: maybeNode.index,
            node: maybeNode.node,
          });

          if (searchState.query) {
            const previousNode =
              rovingTabIndexStateRef.current.node ?? searchStateRef.current.node ?? null;
            onTraceSearch(tree, searchState.query, previousNode);
          }

          // Re-focus the row if in view as well
          maybeFocusRow();
          return maybeNode;
        });
    },
    [api, props.organization, tree, viewManager, searchState, onTraceSearch]
  );

  const onLayoutChange = useCallback(
    (layout: 'drawer bottom' | 'drawer left' | 'drawer right') => {
      setTracePreferences(previousPreferences => {
        return {...previousPreferences, layout, drawer: 0};
      });
    },
    [setTracePreferences]
  );

  const resizeAnimationTimeoutRef = useRef<{id: number} | null>(null);
  const onDrawerResize = useCallback(
    (size: number) => {
      if (resizeAnimationTimeoutRef.current !== null) {
        cancelAnimationTimeout(resizeAnimationTimeoutRef.current);
      }
      resizeAnimationTimeoutRef.current = requestAnimationTimeout(() => {
        setTracePreferences(previousPreferences => {
          return {
            ...previousPreferences,
            drawer:
              size /
              (previousPreferences.layout === 'drawer bottom'
                ? window.innerHeight
                : window.innerWidth),
          };
        });
      }, 1000);
    },
    [setTracePreferences]
  );

  const initialDrawerSize = useMemo(() => {
    if (tracePreferences.drawer < 0) {
      return 0;
    }

    const base =
      tracePreferences.layout === 'drawer bottom'
        ? window.innerHeight
        : window.innerWidth;
    return tracePreferences.drawer * base;
  }, [tracePreferences.drawer, tracePreferences.layout]);

  const scrollQueueRef = useRef<{eventId?: string; path?: TraceTree.NodePath[]} | null>(
    null
  );

  const onResetZoom = useCallback(() => {
    viewManager.resetZoom();
  }, [viewManager]);

  const onTabScrollToNode = useCallback(
    (node: TraceTreeNode<TraceTree.NodeValue>) => {
      scrollToNode(node).then(maybeNode => {
        if (!maybeNode) {
          return;
        }

        viewManager.scrollRowIntoViewHorizontally(maybeNode.node, 0, 12, 'exact');
        if (maybeNode.node.space) {
          viewManager.animateViewTo(maybeNode.node.space);
        }
      });
    },
    [scrollToNode, viewManager]
  );

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
          <TraceSearchInput
            query={searchState.query}
            status={searchState.status}
            onChange={onSearchChange}
            onSearchClear={onSearchClear}
            onKeyDown={onSearchKeyDown}
            onNextSearchClick={onNextSearchClick}
            onPreviousSearchClick={onPreviousSearchClick}
            resultCount={searchState.results?.length}
            resultIteratorIndex={searchState.resultIteratorIndex}
          />
          <Button size="xs" onClick={onResetZoom}>
            {t('Reset Zoom')}
          </Button>
        </TraceToolbar>
        <TraceGrid
          layout={tracePreferences.layout}
          ref={r => (traceContainerRef.current = r)}
        >
          <Trace
            trace={tree}
            trace_id={props.traceSlug}
            roving_dispatch={rovingTabIndexDispatch}
            roving_state={rovingTabIndexState}
            search_dispatch={searchDispatch}
            search_state={searchState}
            onRowClick={onRowClick}
            scrollQueueRef={scrollQueueRef}
            searchResultsIteratorIndex={searchState.resultIndex}
            searchResultsMap={searchState.resultsLookup}
            onTraceSearch={onTraceSearch}
            previouslyFocusedNodeRef={previouslyFocusedNodeRef}
            manager={viewManager}
          />

          {tree.type === 'loading' ? (
            <TraceLoading />
          ) : tree.type === 'error' ? (
            <TraceError />
          ) : tree.type === 'empty' ? (
            <TraceEmpty />
          ) : scrollQueueRef.current ? (
            <TraceLoading />
          ) : null}

          <TraceDrawer
            tabs={tabs}
            trace={tree}
            manager={viewManager}
            scrollToNode={onTabScrollToNode}
            tabsDispatch={tabsDispatch}
            drawerSize={initialDrawerSize}
            layout={tracePreferences.layout}
            onLayoutChange={onLayoutChange}
            onDrawerResize={onDrawerResize}
            rootEventResults={rootEvent}
            organization={props.organization}
            traces={props.trace}
            traceEventView={props.traceEventView}
          />
        </TraceGrid>
      </TraceInnerLayout>
    </TraceExternalLayout>
  );
}

function useQueryParamSync(query: Record<string, string | undefined>) {
  const previousQueryRef = useRef<Record<string, string | undefined>>(query);
  const syncStateTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const keys = Object.keys(query);
    const previousKeys = Object.keys(previousQueryRef.current);

    if (
      keys.length === previousKeys.length &&
      keys.every(key => {
        return query[key] === previousQueryRef.current[key];
      })
    ) {
      previousQueryRef.current = query;
      return;
    }

    if (syncStateTimeoutRef.current !== null) {
      window.clearTimeout(syncStateTimeoutRef.current);
    }

    previousQueryRef.current = query;
    syncStateTimeoutRef.current = window.setTimeout(() => {
      browserHistory.replace({
        pathname: location.pathname,
        query: {
          ...qs.parse(location.search),
          ...previousQueryRef.current,
        },
      });
    }, 1000);
  }, [query]);
}

function useRootEvent(trace: TraceSplitResults<TraceFullDetailed> | null) {
  const root = trace?.transactions[0] || trace?.orphan_errors[0];
  const organization = useOrganization();

  return useApiQuery<EventTransaction>(
    [
      `/organizations/${organization.slug}/events/${root?.project_slug}:${root?.event_id}/`,
      {
        query: {
          referrer: 'trace-details-summary',
        },
      },
    ],
    {
      staleTime: 0,
      enabled: !!trace && !!root,
    }
  );
}

interface TraceMetadataHeaderProps {
  organization: Organization;
  projectID: string;
  title: string;
  traceEventView: EventView;
  traceSlug: string;
}

function TraceMetadataHeader(props: TraceMetadataHeaderProps) {
  const location = useLocation();

  const breadcrumbTransaction = useMemo(() => {
    return {
      project: props.projectID ?? '',
      name: props.title ?? '',
    };
  }, [props.projectID, props.title]);

  const trackOpenInDiscover = useCallback(() => {
    trackAnalytics('performance_views.trace_view.open_in_discover', {
      organization: props.organization,
    });
  }, [props.organization]);

  return (
    <Layout.Header>
      <Layout.HeaderContent>
        <Breadcrumb
          organization={props.organization}
          location={location}
          transaction={breadcrumbTransaction}
          traceSlug={props.traceSlug}
        />
      </Layout.HeaderContent>
      <Layout.HeaderActions>
        <ButtonBar gap={1}>
          <DiscoverButton
            size="sm"
            to={props.traceEventView.getResultsViewUrlTarget(props.organization.slug)}
            onClick={trackOpenInDiscover}
          >
            {t('Open in Discover')}
          </DiscoverButton>
        </ButtonBar>
      </Layout.HeaderActions>
    </Layout.Header>
  );
}

function TraceUXChangeAlert() {
  const [dismiss, setDismissed] = useLocalStorageState('trace-view-dismissed', false);
  if (dismiss) {
    return null;
  }

  return (
    <Alert
      type="info"
      system
      trailingItems={
        <Button
          aria-label="dismiss"
          priority="link"
          size="xs"
          icon={<IconClose />}
          onClick={() => setDismissed(true)}
        />
      }
    >
      {tct(
        'Events now provide richer context by linking directly inside traces. Read [why] we are doing this and what it enables.',
        {
          why: (
            <a href="https://docs.sentry.io/product/sentry-basics/concepts/tracing/trace-view/">
              {t('why')}
            </a>
          ),
        }
      )}
    </Alert>
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
