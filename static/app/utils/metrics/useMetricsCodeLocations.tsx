import {getDateTimeParams, MetricMetaCodeLocation} from 'sentry/utils/metrics';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

type ApiResponse = {
  metrics: MetricMetaCodeLocation[];
};

export function useMetricsCodeLocations(mri: string | undefined) {
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const {data, isLoading, isError, refetch} = useApiQuery<ApiResponse>(
    [
      `/organizations/${organization.slug}/ddm/meta/`,
      {
        query: {
          metric: mri,
          project: selection.projects,
          codeLocations: true,
          ...getDateTimeParams(selection.datetime),
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
