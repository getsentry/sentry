import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import type {MRI} from 'sentry/types';
import {defined} from 'sentry/utils';
import {parseMRI} from 'sentry/utils/metrics/mri';
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

export interface MetricsSamplesResults<F extends string> {
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

  return useApiQuery<MetricsSamplesResults<F>>([path, endpointOptions], {
    staleTime: 0,
    refetchOnWindowFocus: false,
    retry: false,
    enabled,
  });
}

export function isSupportedMRI(mri: MRI): boolean {
  // extracted transaction metrics
  if (mri === 'd:transactions/duration@millisecond') {
    return true;
  }

  // extracted span metrics
  if (
    mri === 'd:spans/exclusive_time@millisecond' ||
    mri === 'd:spans/duration@millisecond'
  ) {
    return true;
  }

  const parsedMRI = parseMRI(mri);
  if (defined(parsedMRI)) {
    // extracted measurement metrics
    if (
      parsedMRI.useCase === 'transactions' &&
      parsedMRI.name.startsWith('measurements.')
    ) {
      return true;
    }

    // user defined custom metrics
    if (parsedMRI.useCase === 'custom') {
      return true;
    }
  }

  return false;
}
