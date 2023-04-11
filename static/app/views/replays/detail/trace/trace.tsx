import {Fragment, useCallback, useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import {Location} from 'history';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {Client, ResponseMeta} from 'sentry/api';
import EmptyMessage from 'sentry/components/emptyMessage';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import {getUtcDateString} from 'sentry/utils/dates';
import {TableData} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {doDiscoverQuery} from 'sentry/utils/discover/genericDiscoverQuery';
import parseLinkHeader from 'sentry/utils/parseLinkHeader';
import {TraceFullDetailed} from 'sentry/utils/performance/quickTrace/types';
import {
  getTraceRequestPayload,
  makeEventView,
} from 'sentry/utils/performance/quickTrace/utils';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import TraceView from 'sentry/views/performance/traceDetails/traceView';
import type {ReplayListLocationQuery, ReplayRecord} from 'sentry/views/replays/types';

type State = {
  /**
   * Error, if not null.
   */
  // error: QueryError | null;
  error: any | null;
  /**
   * Loading state of this query.
   */
  isLoading: boolean;
  /**
   * Loading state of next pages
   */
  isLoadingNext: boolean;
  /**
   * Are there more pages
   */
  nextPage: string | null;
  /**
   * Pagelinks, if applicable. Can be provided to the Pagination component.
   */
  pageLinks: string | null;
  /**
   * EventView that generates API payload
   */
  traceEventView: EventView | null;

  /**
   * Data / result.
   */
  traces: TraceFullDetailed[] | null;
};

interface Props {
  organization: Organization;
  replayRecord: ReplayRecord;
}

const INITIAL_STATE = Object.freeze({
  error: null,
  isLoading: true,
  isLoadingNext: false,
  pageLinks: null,
  traceEventView: null,
  traces: null,
  nextPage: null,
});

function getNextPage(resp?: ResponseMeta) {
  if (!resp) {
    return null;
  }

  const pageLinks = resp.getResponseHeader('Link');
  if (pageLinks) {
    const {next} = parseLinkHeader(pageLinks);
    if (!next.results) {
      return null;
    }

    return next.href;
  }

  return null;
}

interface TraceDetailsParams {
  api: Client;
  end: string;
  location: Location<ReplayListLocationQuery>;
  orgSlug: string;
  start: string;
  traceIds: string[];
}

// TODO(replays): Performance concerns here if number of traceIds is large
async function getTraceDetails({
  api,
  end,
  location,
  orgSlug,
  start,
  traceIds,
}: TraceDetailsParams): Promise<TraceFullDetailed[]> {
  const traceDetails = await Promise.allSettled(
    traceIds.map(traceId =>
      doDiscoverQuery(
        api,
        `/organizations/${orgSlug}/events-trace/${traceId}/`,
        getTraceRequestPayload({
          eventView: makeEventView({start, end}),
          location,
        })
      )
    )
  );

  const successfulTraceDetails = traceDetails
    .map(settled => (settled.status === 'fulfilled' ? settled.value[0] : undefined))
    .filter(Boolean);

  if (successfulTraceDetails.length !== traceDetails.length) {
    traceDetails.forEach(trace => {
      if (trace.status === 'rejected') {
        Sentry.captureMessage(trace.reason);
      }
    });
  }

  return successfulTraceDetails.flat() as TraceFullDetailed[];
}

export default function Trace({replayRecord, organization}: Props) {
  const [state, setState] = useState<State>(INITIAL_STATE);
  const api = useApi();
  const previousTracesLoaded = useRef(new Set<string>());
  const fetchedPages = useRef(new Set<string>());
  // This is used in combination with IntersectionObserver to trigger an
  // infinite scroll.
  const endOfListPlaceholder = useRef(null);
  const location = useLocation<ReplayListLocationQuery>();

  const replayId = replayRecord.id;
  const projectId = replayRecord.project_id;
  const orgSlug = organization.slug;

  const start = getUtcDateString(replayRecord.started_at.getTime());
  const end = getUtcDateString(replayRecord.finished_at.getTime());

  const fetchNext = useCallback(async () => {
    // Do not fetch if already fetching (e.g. scrolling up and down so the
    // placeholder element triggers fetch multiple times)
    if (!state.nextPage || state.isLoadingNext) {
      return;
    }

    // Probably not needed, but make sure we only fetch pages once. This gets
    // reset when `loadTraces` is called
    if (fetchedPages.current.has(state.nextPage)) {
      return;
    }

    fetchedPages.current.add(state.nextPage);

    setState(prevState => ({
      ...prevState,
      isLoadingNext: true,
    }));

    try {
      // Get the trace ids that were loaded in the last page and make sure we
      // don't include them in next page's query. The reason for this is
      // because we can have many traces with the same timestamp, so the next
      // page could include traces that we fetched in the previous page. Note
      // this means we are assuming we will not have multiple pages worth of
      // traces with identical timestamps.
      const excludePreviousPageTraces = Array.from(previousTracesLoaded.current)
        .map(trace => `!trace:${trace}`)
        .join(' ');

      // Filter out query, it should only be filtering by replay id. Note that
      // we will have multiple entries with the same key (e.g. `field`), so we
      // can't turn into an object.
      const path = new URL(state.nextPage);
      const queryParamList = new URLSearchParams(Array.from(path.searchParams.entries()));
      queryParamList.delete('query');
      queryParamList.append('query', `replayId:${replayId} ${excludePreviousPageTraces}`);

      const [data, , resp] = await api.requestPromise(
        `${path.pathname}?${queryParamList.toString()}`,
        {
          includeAllArgs: true,
        }
      );

      const nextPage = getNextPage(resp);
      const traceIds = data.data.map(({trace}) => trace).filter(Boolean);

      // Update the loaded trace ids so the next page does not include this
      // fetch's trace ids
      previousTracesLoaded.current = new Set(traceIds);

      const traces = await getTraceDetails({
        api,
        end,
        location,
        orgSlug,
        start,
        traceIds,
      });

      setState(prevState => ({
        ...prevState,
        nextPage,
        isLoadingNext: false,
        traces: [...(prevState.traces || []), ...traces],
      }));
    } catch {
      fetchedPages.current.delete(state.nextPage);
      setState(prevState => ({
        ...prevState,
        isLoadingNext: false,
      }));
      addErrorMessage(t('Error loading traces'));
    }
  }, [api, end, location, orgSlug, replayId, start, state]);

  useEffect(() => {
    async function loadTraces() {
      fetchedPages.current = new Set();

      const eventView = EventView.fromSavedQuery({
        id: undefined,
        name: `Traces in replay ${replayId}`,
        fields: ['trace', 'count(trace)', 'timestamp'],
        orderby: 'timestamp',
        // XXX: Update `fetchNext` if query is changed
        query: `replayId:${replayId}`,
        projects: [Number(projectId)],
        version: 2,
        start,
        end,
      });

      try {
        const [data, , resp] = await doDiscoverQuery<TableData>(
          api,
          `/organizations/${orgSlug}/events/`,
          {...eventView.getEventsAPIPayload(location), per_page: 25}
        );

        const traceIds = data.data
          .map(({trace}) => trace)
          .filter(Boolean)
          .map(String);

        previousTracesLoaded.current = new Set(traceIds);
        const traces = await getTraceDetails({
          api,
          end,
          location,
          orgSlug,
          start,
          traceIds,
        });

        setState(prevState => ({
          isLoading: false,
          isLoadingNext: false,
          error: null,
          traceEventView: eventView,
          nextPage: getNextPage(resp),
          pageLinks: resp?.getResponseHeader('Link') ?? prevState.pageLinks,
          traces,
        }));
      } catch (err) {
        setState({
          isLoading: false,
          isLoadingNext: false,
          error: err,
          nextPage: null,
          pageLinks: null,
          traceEventView: null,
          traces: null,
        });
      }
    }

    loadTraces();

    return () => {};
  }, [api, replayId, projectId, orgSlug, location, start, end]);

  /**
   * Add a placeholder DOM element at the bottom of the list. Use the
   * IntersectionObserver to detect when placeholder element is visible, if
   * it's visible we call function to fetch more results.
   */
  useEffect(() => {
    const observer = new IntersectionObserver(entities => {
      const [el] = entities;
      // The placeholder at bottom of list is visible, attempt to fetch next
      // page.
      if (el.isIntersecting) {
        fetchNext();
      }
    });

    const placeholderEl = endOfListPlaceholder.current;

    if (!placeholderEl) {
      return () => {};
    }

    observer.observe(placeholderEl);
    return () => {
      if (placeholderEl) {
        observer.unobserve(placeholderEl);
      }
    };
  }, [endOfListPlaceholder, fetchNext]);

  if (state.isLoading) {
    return <LoadingIndicator />;
  }

  if (state.error || !state.traceEventView) {
    return <LoadingError />;
  }

  if (!state.traces?.length) {
    return <EmptyMessage title={t('No traces found')} />;
  }

  return (
    <TraceView
      meta={null}
      traces={state.traces}
      location={location}
      organization={organization}
      traceEventView={state.traceEventView}
      traceSlug="Replay"
      footer={
        <Fragment>
          {state.isLoadingNext ? (
            <LoadingContainer>
              {' '}
              <LoadingIndicator mini />{' '}
            </LoadingContainer>
          ) : null}
          {!state.isLoading ? <InfinitePlaceholder ref={endOfListPlaceholder} /> : null}
        </Fragment>
      }
    />
  );
}

const LoadingContainer = styled('div')`
  display: flex;
  width: 100%;
  justify-content: center;
`;

/**
 * This means next page fetch starts when user is 40px from the bottom of the
 * list.
 */
const InfinitePlaceholder = styled('div')`
  position: relative;
  bottom: 60px;
`;
