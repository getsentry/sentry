import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import type {MRI} from 'sentry/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

interface UseMetricSamplesOptions<F extends string> {
  fields: F[];
  referrer: string;
  enabled?: boolean;
  limit?: number;
  mri?: MRI;
  query?: string;
}

interface MetricSamplesResults<F extends string> {
  data: {
    [K in F]: string[] | string | number | null;
  }[];
  meta: any; // not going to type this yet
}

export function useMetricsSamples<F extends string>({
  enabled,
  fields,
  limit,
  mri,
  referrer,
  query,
}: UseMetricSamplesOptions<F>) {
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const path = `/organizations/${organization.slug}/metrics/samples/`;

  const endpointOptions = {
    query: {
      project: selection.projects,
      environment: selection.environments,
      ...normalizeDateTimeParams(selection.datetime),
      field: fields,
      mri,
      query,
      referrer,
      per_page: limit,
    },
  };

  return useApiQuery<MetricSamplesResults<F>>([path, endpointOptions], {
    staleTime: 0,
    refetchOnWindowFocus: false,
    retry: false,
    enabled,
  });
}
