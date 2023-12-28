import * as Sentry from '@sentry/react';

import {
  getDateTimeParams,
  MetricMetaCodeLocation,
  MetricRange,
} from 'sentry/utils/metrics';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

type ApiResponse = {
  metrics: MetricMetaCodeLocation[];
};

type MetricsDDMMetaOpts = MetricRange & {
  codeLocations?: boolean;
  metricSpans?: boolean;
};

function useMetricsDDMMeta(mri: string | undefined, options: MetricsDDMMetaOpts) {
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const {start, end} = options;
  const dateTimeParams =
    start || end ? {start, end} : getDateTimeParams(selection.datetime);

  const {data, isLoading, isError, refetch} = useApiQuery<ApiResponse>(
    [
      `/organizations/${organization.slug}/ddm/meta/`,
      {
        query: {
          metric: mri,
          project: selection.projects,
          ...options,
          ...dateTimeParams,
        },
      },
    ],
    {
      enabled: !!mri,
      staleTime: Infinity,
    }
  );

  if (!data) {
    return {data, isLoading};
  }

  mapToNewResponseShape(data);
  deduplicateCodeLocations(data);
  sortCodeLocations(data);

  return {data, isLoading, isError, refetch};
}

export function useMetricsSpans(mri: string | undefined, options: MetricRange = {}) {
  return useMetricsDDMMeta(mri, {
    ...options,
    metricSpans: true,
  });
}

export function useMetricsCodeLocations(
  mri: string | undefined,
  options: MetricRange = {}
) {
  return useMetricsDDMMeta(mri, {...options, codeLocations: true});
}

const mapToNewResponseShape = (data: ApiResponse) => {
  // If the response is already in the new shape, do nothing
  if (data.metrics) {
    return;
  }
  // @ts-expect-error codeLocations is defined in the old response shape
  data.metrics = (data.codeLocations ?? [])?.map(codeLocation => {
    return {
      mri: codeLocation.mri,
      timestamp: codeLocation.timestamp,
      codeLocations: (codeLocation.frames ?? []).map(frame => {
        return {
          function: frame.function,
          module: frame.module,
          filename: frame.filename,
          absPath: frame.absPath,
          lineNo: frame.lineNo,
          preContext: frame.preContext,
          contextLine: frame.contextLine,
          postContext: frame.postContext,
        };
      }),
    };
  });

  // @ts-expect-error metricsSpans is defined in the old response shape
  if (data.metricsSpans?.length) {
    Sentry.captureMessage('Non-empty metric spans response');
  }
};

const sortCodeLocations = (data: ApiResponse) => {
  data.metrics.sort((a, b) => {
    return b.timestamp - a.timestamp;
  });
};

const deduplicateCodeLocations = (data: ApiResponse) => {
  data.metrics = data.metrics.filter((element, index) => {
    return !data.metrics.slice(0, index).some(e => equalCodeLocations(e, element));
  });
};

const equalCodeLocations = (a: MetricMetaCodeLocation, b: MetricMetaCodeLocation) => {
  if (a.mri !== b.mri) {
    return false;
  }

  const aCodeLocation = JSON.stringify(a.codeLocations?.[0] ?? {});
  const bCodeLocation = JSON.stringify(b.codeLocations?.[0] ?? {});

  return aCodeLocation === bCodeLocation;
};
