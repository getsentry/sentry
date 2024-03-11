import {useEffect, useMemo, useState} from 'react';
import * as Sentry from '@sentry/react';
import moment from 'moment';

import type {MRI} from 'sentry/types';
import {parsePeriodToHours} from 'sentry/utils/dates';
import {getDateTimeParams} from 'sentry/utils/metrics';
import type {MetricCorrelation, MetricMetaCodeLocation} from 'sentry/utils/metrics/types';
import type {UseApiQueryOptions} from 'sentry/utils/queryClient';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import type {SelectionRange} from 'sentry/views/ddm/chart/types';

type ApiResponse = {
  metrics: MetricMetaCodeLocation[];
};

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

function useMetricsCorrelations(
  mri: MRI | undefined,
  options: MetricCorrelationOpts,
  queryOptions: Partial<UseApiQueryOptions<ApiResponse>> = {}
) {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const dateTimeParams = useDateTimeParams(options);

  const minMaxParams =
    // remove non-numeric values
    options.min && options.max && !isNaN(options.min) && !isNaN(options.max)
      ? {min: options.min, max: options.max}
      : {};

  const queryInfo = useApiQuery<ApiResponse>(
    [
      // TODO(ddm): Clean up this endpoint
      `/organizations/${organization.slug}/metrics/metadata/`,
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
      ...queryOptions,
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

export function useMetricSamples(
  mri: MRI | undefined,
  options: Omit<MetricCorrelationOpts, 'metricSpans'> = {}
) {
  const [isUsingFallback, setIsUseFallback] = useState(false);
  const dateTimeParams = useDateTimeParams(options);

  const mainQuery = useMetricsCorrelations(mri, {
    ...options,
    ...dateTimeParams,
    metricSpans: true,
  });

  const hasTimeParams =
    (!!dateTimeParams.end && !!dateTimeParams.start) || !!dateTimeParams.statsPeriod;
  const periodInHours =
    dateTimeParams.statsPeriod !== undefined
      ? parsePeriodToHours(dateTimeParams.statsPeriod)
      : undefined;

  const {startDate, endDate} = useMemo(() => {
    const end = periodInHours ? moment() : moment(dateTimeParams.end);
    end.set('milliseconds', 0); // trim milliseconds to de-duplicate requests
    return {
      startDate: end.clone().subtract(1, 'hour').set('milliseconds', 0).toISOString(),
      endDate: end.toISOString(),
    };
  }, [dateTimeParams.end, periodInHours]);

  const isFallbackEnabled =
    !!mri &&
    hasTimeParams &&
    (periodInHours ??
      moment(dateTimeParams.start).diff(moment(dateTimeParams.end), 'hours')) > 1;

  const fallbackQuery = useMetricsCorrelations(
    mri,
    {
      ...options,
      start: startDate,
      end: endDate,
      metricSpans: true,
    },
    {
      enabled: isFallbackEnabled,
    }
  );

  useEffect(() => {
    if (mainQuery.isLoading && isFallbackEnabled) {
      const timeout = setTimeout(() => {
        setIsUseFallback(true);
        Sentry.metrics.increment('ddm.correlated_samples.timeout');
      }, 15000);
      return () => clearTimeout(timeout);
    }
    if (!mainQuery.isError) {
      setIsUseFallback(false);
    }
    return () => {};
  }, [mainQuery.isLoading, isFallbackEnabled, mainQuery.isError]);

  const queryInfo = isUsingFallback ? fallbackQuery : mainQuery;

  if (!queryInfo.data) {
    return queryInfo;
  }

  const data = queryInfo.data.metrics
    .flatMap(m => m.metricSpans)
    .filter(correlation => !!correlation)
    .slice(0, 10) as MetricCorrelation[];

  return {...queryInfo, data};
}

export function useMetricCodeLocations(
  mri: MRI | undefined,
  options: Omit<MetricCorrelationOpts, 'codeLocations'> = {}
) {
  return useMetricsCorrelations(mri, {...options, codeLocations: true});
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
