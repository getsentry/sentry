import React, {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import {browserHistory} from 'react-router';
import type {Location} from 'history';
import * as qs from 'query-string';

import ButtonBar from 'sentry/components/buttonBar';
import DiscoverButton from 'sentry/components/discoverButton';
import * as Layout from 'sentry/components/layouts/thirds';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {t} from 'sentry/locale';
import type {EventTransaction, Organization} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import EventView from 'sentry/utils/discover/eventView';
import TraceMetaQuery, {
  type TraceMetaQueryChildrenProps,
} from 'sentry/utils/performance/quickTrace/traceMetaQuery';
import type {
  TraceFullDetailed,
  TraceSplitResults,
} from 'sentry/utils/performance/quickTrace/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import useProjects from 'sentry/utils/useProjects';
import {rovingTabIndexReducer} from 'sentry/views/performance/newTraceDetails/rovingTabIndex';
import {
  searchInTraceTree,
  traceSearchReducer,
} from 'sentry/views/performance/newTraceDetails/traceSearch';
import {TraceSearchInput} from 'sentry/views/performance/newTraceDetails/traceSearchInput';
import {VirtualizedViewManager} from 'sentry/views/performance/newTraceDetails/virtualizedViewManager';

import Breadcrumb from '../breadcrumb';

import TraceDetailPanel from './newTraceDetailPanel';
import Trace from './trace';
import {TraceFooter} from './traceFooter';
import TraceHeader from './traceHeader';
import {TraceTree, type TraceTreeNode} from './traceTree';
import TraceWarnings from './traceWarnings';
import {useTrace} from './useTrace';

const DOCUMENT_TITLE = [t('Trace Details'), t('Performance')].join(' — ');

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
  const location = useLocation();
  const organization = useOrganization();
  const params = useParams<{traceSlug?: string}>();

  const traceSlug = params.traceSlug?.trim() ?? '';

  const queryParams = useMemo(() => {
    const normalizedParams = normalizeDateTimeParams(location.query, {
      allowAbsolutePageDatetime: true,
    });
    const start = decodeScalar(normalizedParams.start);
    const end = decodeScalar(normalizedParams.end);
    const statsPeriod = decodeScalar(normalizedParams.statsPeriod);

    return {start, end, statsPeriod, useSpans: 1};
  }, [location.query]);

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

  return (
    <SentryDocumentTitle title={DOCUMENT_TITLE} orgSlug={organization.slug}>
      <Layout.Page>
        <NoProjectMessage organization={organization}>
          <TraceMetaQuery
            location={location}
            orgSlug={organization.slug}
            traceId={traceSlug}
            start={queryParams.start}
            end={queryParams.end}
            statsPeriod={queryParams.statsPeriod}
          >
            {metaResults => (
              <TraceViewContent
                status={trace.status}
                trace={trace.data}
                traceSlug={traceSlug}
                organization={organization}
                location={location}
                traceEventView={traceEventView}
                metaResults={metaResults}
              />
            )}
          </TraceMetaQuery>
        </NoProjectMessage>
      </Layout.Page>
    </SentryDocumentTitle>
  );
}

type TraceViewContentProps = {
  location: Location;
  metaResults: TraceMetaQueryChildrenProps;
  organization: Organization;
  status: 'pending' | 'resolved' | 'error' | 'initial';
  trace: TraceSplitResults<TraceFullDetailed> | null;
  traceEventView: EventView;
  traceSlug: string;
};

function TraceViewContent(props: TraceViewContentProps) {
  const {projects} = useProjects();

  const rootEvent = useRootEvent(props.trace?.transactions);

  const viewManager = useMemo(() => {
    return new VirtualizedViewManager({
      list: {width: 0.5},
      span_list: {width: 0.5},
    });
  }, []);

  const tree = useMemo(() => {
    if (props.status === 'pending' || rootEvent.status !== 'success') {
      return TraceTree.Loading({
        project_slug: projects?.[0]?.slug ?? '',
        event_id: props.traceSlug,
      });
    }

    if (props.trace) {
      return TraceTree.FromTrace(props.trace, rootEvent.data);
    }

    return TraceTree.Empty();
  }, [
    props.traceSlug,
    props.trace,
    props.status,
    projects,
    rootEvent.data,
    rootEvent.status,
  ]);

  const traceType = useMemo(() => {
    if (props.status !== 'resolved' || !tree) {
      return null;
    }
    return TraceTree.GetTraceType(tree.root);
  }, [props.status, tree]);

  const [rovingTabIndexState, rovingTabIndexDispatch] = useReducer(
    rovingTabIndexReducer,
    {
      index: null,
      items: null,
      node: null,
    }
  );

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
    resultIteratorIndex: undefined,
    resultIndex: undefined,
    results: undefined,
    status: undefined,
    resultsLookup: new Map(),
  });

  const [detailNode, setDetailNode] = useState<TraceTreeNode<TraceTree.NodeValue> | null>(
    null
  );

  const onDetailClose = useCallback(() => {
    setDetailNode(null);
    maybeFocusRow();
  }, []);

  const onSetDetailNode = useCallback(
    (node: TraceTreeNode<TraceTree.NodeValue> | null) => {
      setDetailNode(prevNode => {
        return prevNode === node ? null : node;
      });
      maybeFocusRow();
    },
    []
  );

  const searchingRaf = useRef<{id: number | null} | null>(null);
  const onTraceSearch = useCallback(
    (query: string) => {
      if (searchingRaf.current?.id) {
        window.cancelAnimationFrame(searchingRaf.current.id);
      }

      searchingRaf.current = searchInTraceTree(query, tree, results => {
        searchDispatch({
          type: 'set results',
          results: results[0],
          resultsLookup: results[1],
        });
      });
    },
    [tree]
  );

  const previousIndexRef = React.useRef<number | undefined>(searchState.resultIndex);
  useLayoutEffect(() => {
    if (previousIndexRef.current === searchState.resultIndex) {
      return;
    }
    if (!viewManager.list) {
      return;
    }

    viewManager.list.scrollToRow(searchState.resultIndex);
    previousIndexRef.current = searchState.resultIndex;
  }, [searchState.resultIndex, viewManager.list]);

  const onSearchChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (!event.currentTarget.value) {
        searchDispatch({type: 'clear query'});
        return;
      }

      onTraceSearch(event.currentTarget.value);
      searchDispatch({type: 'set query', query: event.currentTarget.value});
    },
    [onTraceSearch]
  );

  const onSearchClear = useCallback(() => {
    searchDispatch({type: 'clear query'});
  }, []);

  const onSearchKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      searchDispatch({type: 'go to next match'});
    } else {
      if (event.key === 'ArrowUp') {
        searchDispatch({type: 'go to previous match'});
      }
    }
  }, []);

  const onNextSearchClick = useCallback(() => {
    searchDispatch({type: 'go to next match'});
  }, []);

  const onPreviousSearchClick = useCallback(() => {
    searchDispatch({type: 'go to previous match'});
  }, []);

  const breadcrumbTransaction = useMemo(() => {
    return {
      project: rootEvent.data?.projectID ?? '',
      name: rootEvent.data?.title ?? '',
    };
  }, [rootEvent.data]);

  const trackOpenInDiscover = useCallback(() => {
    trackAnalytics('performance_views.trace_view.open_in_discover', {
      organization: props.organization,
    });
  }, [props.organization]);

  const syncQuery = useMemo(() => {
    return {search: searchState.query};
  }, [searchState.query]);

  useQueryParamSync(syncQuery);

  return (
    <Fragment>
      <Layout.Header>
        <Layout.HeaderContent>
          <Breadcrumb
            organization={props.organization}
            location={props.location}
            transaction={breadcrumbTransaction}
            traceSlug={props.traceSlug}
          />
          <Layout.Title data-test-id="trace-header">
            {t('Trace ID: %s', props.traceSlug)}
          </Layout.Title>
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
      <Layout.Body>
        <Layout.Main fullWidth>
          {traceType ? <TraceWarnings type={traceType} /> : null}
          <TraceHeader
            rootEventResults={rootEvent}
            metaResults={props.metaResults}
            organization={props.organization}
            traces={props.trace}
          />
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
          <Trace
            trace={tree}
            trace_id={props.traceSlug}
            roving_dispatch={rovingTabIndexDispatch}
            roving_state={rovingTabIndexState}
            search_dispatch={searchDispatch}
            search_state={searchState}
            setDetailNode={onSetDetailNode}
            searchResultsIteratorIndex={searchState.resultIndex}
            searchResultsMap={searchState.resultsLookup}
            onTraceSearch={onTraceSearch}
            manager={viewManager}
          />
          <TraceFooter
            rootEventResults={rootEvent}
            organization={props.organization}
            location={props.location}
            traces={props.trace}
            traceEventView={props.traceEventView}
          />
          {<TraceDetailPanel node={detailNode} onClose={onDetailClose} />}
        </Layout.Main>
      </Layout.Body>
    </Fragment>
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

function useRootEvent(trace: TraceFullDetailed[] | undefined) {
  const root = trace?.[0];
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
      enabled: !!trace,
    }
  );
}
