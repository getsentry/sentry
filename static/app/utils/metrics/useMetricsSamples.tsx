import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import type {MRI, PageFilters} from 'sentry/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

interface UseMetricSamplesOptions<F extends string> {
  fields: F[];
  referrer: string;
  datetime?: PageFilters['datetime'];
  enabled?: boolean;
  limit?: number;
  max?: number;
  min?: number;
  mri?: MRI;
  query?: string;
  sort?: string;
}

export interface MetricsSamplesResults<F extends string> {
  data: {
    [K in F]: string[] | string | number | null;
  }[];
  meta: any; // not going to type this yet
}

export function useMetricsSamples<F extends string>({
  datetime,
  enabled,
  fields,
  limit,
  max,
  min,
  mri,
  referrer,
  query,
  sort,
}: UseMetricSamplesOptions<F>) {
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const path = `/organizations/${organization.slug}/metrics/samples/`;

  const endpointOptions = {
    query: {
      project: selection.projects,
      environment: selection.environments,
      ...(datetime ?? normalizeDateTimeParams(selection.datetime)),
      field: fields,
      max,
      min,
      mri,
      query,
      referrer,
      per_page: limit,
      sort,
    },
  };

  return useApiQuery<MetricsSamplesResults<F>>([path, endpointOptions], {
    staleTime: 0,
    refetchOnWindowFocus: false,
    retry: false,
    enabled,
  });
}
