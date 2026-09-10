import {skipToken, useQuery} from '@tanstack/react-query';
import type {Query} from 'history';

import {QUERY_EMBED_ROW_LIMIT} from 'sentry/components/seer/markdown/embeds/components/queryEmbed/queryEmbedConstants';
import type {EventsStats, MultiSeriesEventsStats} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import type {TableData} from 'sentry/utils/discover/discoverQuery';
import type {EventView} from 'sentry/utils/discover/eventView';
import {useOrganization} from 'sentry/utils/useOrganization';

/** Previews are cheap and short-lived; don't refetch one the reader just saw. */
const STALE_TIME = 30_000;

/**
 * The row preview behind `/organizations/$org/events/`. Every Discover-backed
 * query embed — errors, spans, logs, metrics — differs only in the dataset its
 * `EventView` carries.
 */
export function useQueryEmbedEventsTable({
  enabled,
  eventView,
  referrer,
}: {
  /** False for a query whose results collapse to a single row. */
  enabled: boolean;
  eventView: EventView;
  referrer: string;
}) {
  const organization = useOrganization();

  return useQuery({
    ...apiOptions.as<TableData>()('/organizations/$organizationIdOrSlug/events/', {
      path: enabled ? {organizationIdOrSlug: organization.slug} : skipToken,
      query: {
        ...eventView.generateQueryStringObject(),
        per_page: QUERY_EMBED_ROW_LIMIT,
        referrer,
      },
      staleTime: STALE_TIME,
    }),
    retry: false,
  });
}

/**
 * The timeseries behind `/organizations/$org/events-stats/`. Callers build the
 * query themselves — whether the chart splits into a series per group is the
 * one thing that genuinely differs between datasets.
 */
export function useQueryEmbedEventsStats(query: Query) {
  const organization = useOrganization();

  return useQuery({
    ...apiOptions.as<EventsStats | MultiSeriesEventsStats>()(
      '/organizations/$organizationIdOrSlug/events-stats/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query,
        staleTime: STALE_TIME,
      }
    ),
    retry: false,
  });
}
