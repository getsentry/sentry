import {keepPreviousData as keepPreviousDataFn} from '@tanstack/react-query';
import moment from 'moment-timezone';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import type {CaseInsensitive} from 'sentry/components/searchQueryBuilder/hooks';
import {defined} from 'sentry/utils/defined';
import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import type {EventsMetaType, EventView} from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {intervalToMilliseconds} from 'sentry/utils/duration/intervalToMilliseconds';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {
  RPCQueryExtras,
  SamplingMode,
} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {
  getRetryDelay,
  shouldRetryHandler,
} from 'sentry/views/insights/common/utils/retryHandlers';

import type {ExtrapolationMode} from './types';

const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
const FOURTEEN_DAYS = 14 * 24 * 60 * 60 * 1000;
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
const SIXTY_DAYS = 60 * 24 * 60 * 60 * 1000;

type SpansQueryProps<T = any[]> = {
  allowAggregateConditions?: boolean;
  cursor?: string;
  enabled?: boolean;
  eventView?: EventView;
  initialData?: T;
  keepPreviousData?: boolean;
  limit?: number;
  queryExtras?: RPCQueryExtras;
  referrer?: string;
  staleTime?: number;
};

export function useSpansQuery<T = any[]>(props: SpansQueryProps<T>) {
  const {isReady: pageFiltersReady} = usePageFilters();
  return useWrappedDiscoverQuery<T>(
    toWrappedDiscoverQueryProps({
      ...props,
      enabled: (props.enabled ?? true) && pageFiltersReady,
    })
  );
}

export function useSpansQueryWithoutPageFilters<T = any[]>(props: SpansQueryProps<T>) {
  return useWrappedDiscoverQueryWithoutPageFilters<T>(
    toWrappedDiscoverQueryProps({...props, enabled: props.enabled ?? true})
  );
}

function toWrappedDiscoverQueryProps<T>({
  eventView,
  queryExtras,
  referrer = 'use-spans-query',
  ...props
}: SpansQueryProps<T>): WrappedDiscoverQueryProps<T> {
  if (!eventView) {
    throw new Error(
      'eventView argument must be defined when Starfish useDiscover is true'
    );
  }

  return {
    ...props,
    eventView: eventView.clone(),
    referrer,
    caseInsensitive: queryExtras?.caseInsensitive,
    samplingMode: queryExtras?.samplingMode,
    disableAggregateExtrapolation: queryExtras?.disableAggregateExtrapolation,
    logQuery: queryExtras?.logQuery,
    metricQuery: queryExtras?.metricQuery,
    spanQuery: queryExtras?.spanQuery,
  };
}

type WrappedDiscoverQueryProps<T> = {
  eventView: EventView;
  additionalQueryKey?: string[];
  allowAggregateConditions?: boolean;
  caseInsensitive?: CaseInsensitive;
  cursor?: string;
  disableAggregateExtrapolation?: string;
  enabled?: boolean;
  extrapolationMode?: ExtrapolationMode;
  initialData?: T;
  keepPreviousData?: boolean;
  limit?: number;
  logQuery?: string[];
  metricQuery?: string[];
  noPagination?: boolean;
  referrer?: string;
  refetchInterval?: number;
  samplingMode?: SamplingMode;
  spanQuery?: string[];
  staleTime?: number;
};

function useWrappedDiscoverQueryBase<T>({
  eventView,
  initialData,
  enabled,
  keepPreviousData,
  referrer,
  limit,
  cursor,
  noPagination,
  allowAggregateConditions,
  disableAggregateExtrapolation,
  samplingMode,
  pageFiltersReady,
  additionalQueryKey,
  refetchInterval,
  caseInsensitive,
  logQuery,
  metricQuery,
  spanQuery,
  extrapolationMode,
  staleTime,
}: WrappedDiscoverQueryProps<T> & {
  pageFiltersReady: boolean;
}) {
  const location = useLocation();
  const organization = useOrganization();

  const queryExtras: Record<string, string | string[]> = {};
  if (
    [DiscoverDatasets.SPANS, DiscoverDatasets.TRACEMETRICS].includes(eventView.dataset!)
  ) {
    if (samplingMode) {
      queryExtras.sampling = samplingMode;
    }
    if (extrapolationMode) {
      queryExtras.extrapolationMode = extrapolationMode;
    }

    if (disableAggregateExtrapolation) {
      queryExtras.disableAggregateExtrapolation = '1';
    }
  }

  if (typeof caseInsensitive === 'boolean' && caseInsensitive) {
    queryExtras.caseInsensitive = '1';
  }

  if (Array.isArray(logQuery) && logQuery.length > 0) {
    queryExtras.logQuery = logQuery;
  }

  if (Array.isArray(metricQuery) && metricQuery.length > 0) {
    queryExtras.metricQuery = metricQuery;
  }

  if (Array.isArray(spanQuery) && spanQuery.length > 0) {
    queryExtras.spanQuery = spanQuery;
  }

  if (allowAggregateConditions !== undefined) {
    queryExtras.allowAggregateConditions = allowAggregateConditions ? '1' : '0';
  }

  const result = useDiscoverQuery({
    eventView,
    orgSlug: organization.slug,
    location,
    referrer,
    cursor,
    limit,
    options: {
      enabled: enabled && pageFiltersReady, // TODO this has a bug: if enabled is undefined, this short-circuits to undefined, which becomes true, regardless of pageFiltersReady
      refetchOnWindowFocus: false,
      retry: shouldRetryHandler,
      retryDelay: getRetryDelay,
      staleTime: staleTime ?? getStaleTimeForEventView(eventView),
      additionalQueryKey,
      refetchInterval,
      placeholderData: keepPreviousData ? keepPreviousDataFn : undefined,
    },
    queryExtras,
    noPagination,
  });

  // TODO: useDiscoverQuery incorrectly states that it returns MetaType, but it
  // does not!
  const meta = result.data?.meta as EventsMetaType | undefined;

  const data =
    result.isPending && initialData ? initialData : (result.data?.data as T | undefined);

  return {
    ...result,
    data,
    meta,
  };
}

export function useWrappedDiscoverQuery<T>(props: WrappedDiscoverQueryProps<T>) {
  const {isReady: pageFiltersReady} = usePageFilters();
  return useWrappedDiscoverQueryBase({...props, pageFiltersReady});
}

export function useWrappedDiscoverQueryWithoutPageFilters<T>(
  props: WrappedDiscoverQueryProps<T>
) {
  return useWrappedDiscoverQueryBase({...props, pageFiltersReady: true});
}

function getStaleTimeForRelativePeriodTable(statsPeriod: string | undefined) {
  if (!defined(statsPeriod)) {
    return Infinity;
  }
  const periodInMs = intervalToMilliseconds(statsPeriod);

  if (periodInMs <= SEVEN_DAYS) {
    return 0;
  }

  if (periodInMs <= FOURTEEN_DAYS) {
    return 10 * 1000;
  }

  if (periodInMs <= THIRTY_DAYS) {
    return 30 * 1000;
  }

  if (periodInMs <= SIXTY_DAYS) {
    return 60 * 1000;
  }

  return 5 * 60 * 1000;
}

export function getStaleTimeForEventView(eventView: EventView) {
  const usesRelativeDateRange =
    !defined(eventView.start) &&
    !defined(eventView.end) &&
    defined(eventView.statsPeriod);
  if (usesRelativeDateRange) {
    return getStaleTimeForRelativePeriodTable(eventView.statsPeriod);
  }
  if (isEventViewEndInFuture(eventView)) {
    return 0;
  }
  return Infinity;
}

export function isEventViewEndInFuture(eventView: EventView) {
  return defined(eventView.end) && moment.utc(eventView.end).isAfter();
}
