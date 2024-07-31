import type {SelectionRange} from 'sentry/components/metrics/chart/types';
import type {MRI} from 'sentry/types/metrics';
import {getDateTimeParams} from 'sentry/utils/metrics';
import type {MetricMetaCodeLocation} from 'sentry/utils/metrics/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

type MetricCorrelationOpts = SelectionRange & {
  codeLocations?: boolean;
  metricSpans?: boolean;
  query?: string;
};

function useDateTimeParams(options: MetricCorrelationOpts) {
  const {selection} = usePageFilters();

  const {start, end} = options;
  return start || end
    ? {start, end, statsPeriod: undefined}
    : getDateTimeParams(selection.datetime);
}

export function useMetricCodeLocations(
  mri: MRI | undefined,
  options: MetricCorrelationOpts
) {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const dateTimeParams = useDateTimeParams(options);

  const minMaxParams =
    // remove non-numeric values
    options.min && options.max && !isNaN(options.min) && !isNaN(options.max)
      ? {min: options.min, max: options.max}
      : {};

  const queryInfo = useApiQuery<MetricMetaCodeLocation[]>(
    [
      `/organizations/${organization.slug}/metrics/code-locations/`,
      {
        query: {
          metric: mri,
          project: selection.projects,
          environment: selection.environments,
          query: options.query,
          ...dateTimeParams,
          ...minMaxParams,
        },
      },
    ],
    {
      enabled: !!mri,
      staleTime: Infinity,
    }
  );

  if (!queryInfo.data) {
    return queryInfo;
  }

  const deduped = queryInfo.data
    .filter(
      (item, index, self) => index === self.findIndex(t => equalCodeLocations(t, item))
    )
    .sort((a, b) => {
      return a.timestamp - b.timestamp;
    });

  return {...queryInfo, data: deduped};
}

const equalCodeLocations = (a: MetricMetaCodeLocation, b: MetricMetaCodeLocation) => {
  if (a.mri !== b.mri) {
    return false;
  }

  const aCodeLocation = JSON.stringify(a.codeLocations?.[0] ?? {});
  const bCodeLocation = JSON.stringify(b.codeLocations?.[0] ?? {});

  return aCodeLocation === bCodeLocation;
};
