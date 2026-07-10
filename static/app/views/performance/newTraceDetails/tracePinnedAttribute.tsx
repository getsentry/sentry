import {useCallback, useMemo} from 'react';
import {useInfiniteQuery} from '@tanstack/react-query';

import {Button} from '@sentry/scraps/button';
import {Tooltip} from '@sentry/scraps/tooltip';

import {IconClose, IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {NewQuery} from 'sentry/types/organization';
import {apiFetch, useFetchAllPages} from 'sentry/utils/api/apiFetch';
import type {
  CanonicalApiQueryKey,
  InfiniteApiQueryKey,
} from 'sentry/utils/api/apiQueryKey';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {prettifyAttributeName} from 'sentry/views/explore/components/traceItemAttributes/utils';
import type {VirtualizedViewManager} from 'sentry/views/performance/newTraceDetails/traceRenderers/virtualizedViewManager';

import {useTraceEventView} from './useTraceEventView';
import {useTraceQueryParams} from './useTraceQueryParams';

/**
 * URL query param that holds the single pinned attribute key. The URL is the
 * source of truth so the pinned column is shareable and survives a reload.
 */
export const PINNED_ATTRIBUTE_QUERY_KEY = 'pinnedAttribute';

/**
 * Width (in px) of the pinned attribute column that sits between the trace tree
 * and the duration waterfall. Both the per-row cells and the header use this.
 */
export const PINNED_COLUMN_WIDTH = 160;

const EMPTY_VALUE = '—';
const LOADING_VALUE = '…';
const EVENTS_PAGE_SIZE = 100;
const PINNED_ATTRIBUTE_GC_TIME = 5 * 60 * 1000;

type PinnedAttributeValue = boolean | number | string | null | undefined;

type PinnedAttributeEventsResponse = {
  data: Array<{[key: string]: PinnedAttributeValue; span_id?: string}>;
};

export interface TracePinnedAttributeData {
  hasError: boolean;
  isLoading: boolean;
  resolvedSpanIds: Set<string>;
  valuesBySpanId: Map<string, PinnedAttributeValue>;
}

/**
 * Loads the pinned field and span ID from the events endpoint without changing
 * the trace query. Span IDs are requested in waterfall order, one batch at a
 * time, so values fill in from the top of the trace downward.
 */
export function useTracePinnedAttributeData({
  pinnedAttribute,
  spanIds,
  traceSlug,
}: {
  pinnedAttribute: string | null;
  spanIds: string[];
  traceSlug: string | undefined;
}): TracePinnedAttributeData {
  const organization = useOrganization();
  const location = useLocation();
  const queryParams = useTraceQueryParams();
  const eventViewOverrides = useMemo<Partial<NewQuery>>(
    () => ({
      dataset: DiscoverDatasets.SPANS,
      fields: pinnedAttribute ? ['span_id', pinnedAttribute] : ['span_id'],
    }),
    [pinnedAttribute]
  );
  const eventView = useTraceEventView(traceSlug ?? '', queryParams, eventViewOverrides);
  const orderedSpanIds = useMemo(() => Array.from(new Set(spanIds)), [spanIds]);
  const eventsUrl = getApiUrl('/organizations/$organizationIdOrSlug/events/', {
    path: {organizationIdOrSlug: organization.slug},
  });
  const eventsQuery = {
    ...eventView.getEventsAPIPayload(location),
    cursor: undefined,
    dataset: DiscoverDatasets.SPANS,
    per_page: EVENTS_PAGE_SIZE,
    referrer: 'api.trace-view.get-events',
  };
  const queryKey = [
    eventsUrl,
    {query: eventsQuery},
    {infinite: true},
  ] as const satisfies InfiniteApiQueryKey;

  const result = useInfiniteQuery({
    queryKey,
    queryFn: context => {
      const search = new MutableSearch(String(eventsQuery.query ?? ''));
      search.addFilterValue('span_id', `[${context.pageParam.join(',')}]`);
      const batchQueryKey: CanonicalApiQueryKey = [
        eventsUrl,
        {query: {...eventsQuery, query: search.formatString()}},
        {infinite: false},
      ];

      return apiFetch<PinnedAttributeEventsResponse>({
        ...context,
        queryKey: batchQueryKey,
      });
    },
    initialPageParam: orderedSpanIds.slice(0, EVENTS_PAGE_SIZE),
    getNextPageParam: (_lastPage, _allPages, _lastPageParam, allPageParams) => {
      const requestedSpanIds = new Set(allPageParams.flat());
      const nextBatch = orderedSpanIds
        .filter(spanId => !requestedSpanIds.has(spanId))
        .slice(0, EVENTS_PAGE_SIZE);
      return nextBatch.length ? nextBatch : undefined;
    },
    enabled: Boolean(pinnedAttribute && traceSlug && orderedSpanIds.length),
    staleTime: Infinity,
    gcTime: PINNED_ATTRIBUTE_GC_TIME,
  });

  const {resolvedSpanIds, valuesBySpanId} = useMemo(() => {
    const resolved = new Set<string>();
    const values = new Map<string, PinnedAttributeValue>();

    for (const page of result.data?.pages ?? []) {
      for (const row of page.json.data) {
        if (!row.span_id) {
          continue;
        }
        resolved.add(row.span_id);
        values.set(row.span_id, pinnedAttribute ? row[pinnedAttribute] : undefined);
      }
    }

    return {resolvedSpanIds: resolved, valuesBySpanId: values};
  }, [pinnedAttribute, result.data?.pages]);

  useFetchAllPages({result});

  const hasError = result.isError || result.isFetchNextPageError;
  const isLoading =
    Boolean(pinnedAttribute) &&
    !hasError &&
    (result.isPending || result.isFetchingNextPage || Boolean(result.hasNextPage));

  return useMemo(
    () => ({hasError, isLoading, resolvedSpanIds, valuesBySpanId}),
    [hasError, isLoading, resolvedSpanIds, valuesBySpanId]
  );
}

interface UseTracePinnedAttribute {
  pinnedAttribute: string | null;
  setPinnedAttribute: (attribute: string | null) => void;
}

/**
 * Reads and writes the pinned attribute from the URL. Uses `useLocation` (which
 * is reactive to navigation) rather than `useTraceQueryParams` (which memoizes
 * on mount and does not react to URL changes).
 */
export function useTracePinnedAttribute(): UseTracePinnedAttribute {
  const location = useLocation();
  const navigate = useNavigate();

  const pinnedAttribute =
    decodeScalar(location.query[PINNED_ATTRIBUTE_QUERY_KEY]) || null;

  const setPinnedAttribute = useCallback(
    (attribute: string | null) => {
      const query = {...location.query};
      if (attribute) {
        query[PINNED_ATTRIBUTE_QUERY_KEY] = attribute;
      } else {
        delete query[PINNED_ATTRIBUTE_QUERY_KEY];
      }
      navigate({pathname: location.pathname, query}, {replace: true});
    },
    [location.pathname, location.query, navigate]
  );

  return {pinnedAttribute, setPinnedAttribute};
}

/**
 * A single cell in the pinned attribute column, rendered once per waterfall row.
 * Renders a loading marker while its events row is unresolved and a muted
 * placeholder when the resolved span has no value for the pinned attribute.
 *
 * The value lives in an inner element that the view manager translates so the
 * whole column scrolls horizontally as one unit (mirroring the tree column).
 */
export function TracePinnedAttributeColumn({
  manager,
  value,
  isLoading,
}: {
  isLoading: boolean;
  manager: VirtualizedViewManager;
  value: PinnedAttributeValue;
}) {
  const hasValue = value !== undefined && value !== null && value !== '';
  const displayValue = isLoading ? LOADING_VALUE : hasValue ? String(value) : EMPTY_VALUE;

  return (
    <div
      className="TracePinnedColumn"
      style={{width: PINNED_COLUMN_WIDTH}}
      ref={manager.registerPinnedColumnRef}
    >
      <div className="TracePinnedColumnInner">
        <span
          className={`TracePinnedColumnValue ${hasValue && !isLoading ? '' : 'Empty'}`}
          title={hasValue && !isLoading ? displayValue : undefined}
        >
          {displayValue}
        </span>
      </div>
    </div>
  );
}

/**
 * The header cell for the pinned attribute column. Shows the prettified
 * attribute name and an unpin button. Rendered once, in the waterfall header.
 */
export function TracePinnedAttributeHeader({
  pinnedAttribute,
  hasError = false,
}: {
  pinnedAttribute: string;
  hasError?: boolean;
}) {
  const {setPinnedAttribute} = useTracePinnedAttribute();
  const label = prettifyAttributeName(pinnedAttribute);

  return (
    <div className="TracePinnedColumnHeader" style={{width: PINNED_COLUMN_WIDTH}}>
      <Tooltip title={label} showOnlyOnOverflow>
        <span className="TracePinnedColumnHeaderLabel">{label}</span>
      </Tooltip>
      {hasError ? (
        <Tooltip title={t('Some pinned attribute values could not be loaded')}>
          <IconWarning
            size="xs"
            variant="warning"
            aria-label={t('Pinned attribute values are incomplete')}
          />
        </Tooltip>
      ) : null}
      <Button
        size="zero"
        variant="transparent"
        icon={<IconClose size="xs" />}
        aria-label={t('Remove pinned column')}
        onClick={() => setPinnedAttribute(null)}
      />
    </div>
  );
}
