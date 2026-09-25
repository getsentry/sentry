import {useQuery} from '@tanstack/react-query';

import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import type {DiscoverDatasets} from 'sentry/utils/discover/types';
import type {Annotation} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import {useOrganization} from 'sentry/utils/useOrganization';

interface AnnotationsResponse {
  droppedAnnotations: Annotation[];
  meta: {
    dataset: string;
    end: number;
    interval: number;
    start: number;
  };
  acceptedAnnotations?: Annotation[];
}

interface UseFetchDroppedDataAnnotationsOptions {
  dataset: DiscoverDatasets;
  /**
   * Bucket granularity, as a string. e.g., `"1h"`. Controls the annotation
   * bucket width directly, independent of any chart's resolved interval.
   */
  interval: string;
  enabled?: boolean;
}

/**
 * Fetch data-fidelity annotations from the dedicated `/events-annotations/`
 * endpoint.
 *
 * Unlike the inline `meta.droppedAnnotations` on `/events-timeseries/`, this
 * runs no chart query — the annotations are served on their own, so they no
 * longer piggyback on the chart request.
 */
export function useFetchDroppedDataAnnotations({
  dataset,
  interval,
  enabled = true,
}: UseFetchDroppedDataAnnotationsOptions) {
  const organization = useOrganization();
  const {isReady: arePageFiltersReady, selection} = usePageFilters();

  return useQuery({
    ...apiOptions.as<AnnotationsResponse>()(
      '/organizations/$organizationIdOrSlug/events-annotations/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: {
          dataset,
          interval,
          ...normalizeDateTimeParams(selection.datetime),
          project: selection.projects,
          environment: selection.environments,
        },
        staleTime: Infinity,
      }
    ),
    refetchOnWindowFocus: false,
    enabled: enabled && arePageFiltersReady,
  });
}
