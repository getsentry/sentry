import {getDateTimeParams, MetricMetaCodeLocation} from 'sentry/utils/metrics';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

type ApiResponse = {codeLocations: MetricMetaCodeLocation[]};

export function useMetricsCodeLocations(mri: string | undefined) {
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const {data, isLoading, isError, refetch} = useApiQuery<{
    codeLocations: MetricMetaCodeLocation[];
  }>(
    [
      `/organizations/${organization.slug}/ddm/meta/`,
      {
        query: {
          metric: mri,
          project: selection.projects,
          ...getDateTimeParams(selection.datetime),
        },
      },
    ],
    {
      enabled: !!mri,
      staleTime: Infinity,
    }
  );

  if (
    !data ||
    !Array.isArray(data?.codeLocations) ||
    !Array.isArray(data?.codeLocations[0]?.frames)
  ) {
    return {data, isLoading};
  }

  deduplicateCodeLocations(data);
  sortCodeLocations(data);

  return {data, isLoading, isError, refetch};
}

const sortCodeLocations = (data: ApiResponse) => {
  data.codeLocations.sort((a, b) => {
    return b.timestamp - a.timestamp;
  });
};

const deduplicateCodeLocations = (data: ApiResponse) => {
  data.codeLocations = data.codeLocations.filter((element, index) => {
    return !data.codeLocations.slice(0, index).some(e => equalCodeLocations(e, element));
  });
};

const equalCodeLocations = (a: MetricMetaCodeLocation, b: MetricMetaCodeLocation) => {
  if (a.mri !== b.mri) {
    return false;
  }

  const aFrame = JSON.stringify(a.frames?.[0] ?? {});
  const bFrame = JSON.stringify(b.frames?.[0] ?? {});

  return aFrame === bFrame;
};
