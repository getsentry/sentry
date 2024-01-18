import {MRI} from 'sentry/types';
import {
  getDateTimeParams,
  MetricCorrelation,
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
  query?: string;
};

function useMetricsDDMMeta(mri: MRI | undefined, options: MetricsDDMMetaOpts) {
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const {start, end} = options;
  const dateTimeParams =
    start || end ? {start, end} : getDateTimeParams(selection.datetime);

  const minMaxParams =
    // remove non-numeric values
    options.min && options.max && !isNaN(options.min) && !isNaN(options.max)
      ? {min: options.min, max: options.max}
      : {};

  const queryInfo = useApiQuery<ApiResponse>(
    [
      `/organizations/${organization.slug}/ddm/meta/`,
      {
        query: {
          metric: mri,
          project: selection.projects,
          environment: selection.environments,
          codeLocations: options.codeLocations,
          metricSpans: options.metricSpans,
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

  const data = sortCodeLocations(
    deduplicateCodeLocations(mapToNewResponseShape(queryInfo.data, mri))
  );

  return {...queryInfo, data};
}

export function useCorrelatedSamples(
  mri: MRI | undefined,
  options: Omit<MetricsDDMMetaOpts, 'metricSpans'> = {}
) {
  return useMetricsDDMMeta(mri, {
    ...options,
    metricSpans: true,
  });
}

export function useMetricsCodeLocations(
  mri: MRI | undefined,
  options: Omit<MetricsDDMMetaOpts, 'codeLocations'> = {}
) {
  return useMetricsDDMMeta(mri, {...options, codeLocations: true});
}

const mapToNewResponseShape = (
  data: ApiResponse & {metricSpans?: MetricCorrelation[]},
  mri: MRI | undefined
) => {
  // If the response is already in the new shape, do nothing
  if (data.metrics) {
    return data;
  }

  const newData = {...data};
  // @ts-expect-error codeLocations is defined in the old response shape
  newData.metrics = (data.codeLocations ?? [])?.map(codeLocation => {
    return {
      mri: codeLocation.mri,
      timestamp: codeLocation.timestamp,
      metricSpans: data.metricSpans,
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

  if (!newData.metrics.length && data.metricSpans?.length && mri) {
    newData.metrics = data.metricSpans.map(metricSpan => {
      return {
        mri,
        // TODO(ddm): Api has inconsistent timestamp formats between codeLocations and metricSpans
        timestamp: new Date(metricSpan.timestamp).getTime(),
        metricSpans: data.metricSpans,
        codeLocations: [],
      };
    });
  }

  return newData;
};

const sortCodeLocations = (data: ApiResponse) => {
  const newData = {...data};
  newData.metrics = [...data.metrics].sort((a, b) => {
    return b.timestamp - a.timestamp;
  });
  return newData;
};

const deduplicateCodeLocations = (data: ApiResponse) => {
  const newData = {...data};
  newData.metrics = data.metrics.filter((element, index) => {
    return !data.metrics.slice(0, index).some(e => equalCodeLocations(e, element));
  });
  return newData;
};

const equalCodeLocations = (a: MetricMetaCodeLocation, b: MetricMetaCodeLocation) => {
  if (a.mri !== b.mri) {
    return false;
  }

  const aCodeLocation = JSON.stringify(a.codeLocations?.[0] ?? {});
  const bCodeLocation = JSON.stringify(b.codeLocations?.[0] ?? {});

  return aCodeLocation === bCodeLocation;
};
