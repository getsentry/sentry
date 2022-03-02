import {addErrorMessage} from 'sentry/actionCreators/indicator';
import MetricsMetaActions from 'sentry/actions/metricsMetaActions';
import MetricsTagActions from 'sentry/actions/metricTagActions';
import {Client} from 'sentry/api';
import {getInterval} from 'sentry/components/charts/utils';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {t} from 'sentry/locale';
import MetricsTagStore from 'sentry/stores/metricsTagStore';
import {
  DateString,
  MetricMeta,
  MetricsApiResponse,
  MetricTag,
  Organization,
} from 'sentry/types';
import {defined} from 'sentry/utils';
import handleXhrErrorResponse from 'sentry/utils/handleXhrErrorResponse';

export type DoMetricsRequestOptions = {
  field: string[];
  orgSlug: Organization['slug'];
  cursor?: string;
  end?: DateString;
  environment?: Readonly<string[]>;
  groupBy?: string[];
  includeAllArgs?: boolean;
  interval?: string;
  limit?: number;
  orderBy?: string;
  project?: Readonly<number[]>;
  query?: string;
  start?: DateString;
  statsPeriod?: string | null;
  statsPeriodEnd?: string;
  statsPeriodStart?: string;
};

export const doMetricsRequest = (
  api: Client,
  {
    field,
    orgSlug,
    cursor,
    environment,
    groupBy,
    interval,
    limit,
    orderBy,
    project,
    query,
    includeAllArgs = false,
    statsPeriodStart,
    statsPeriodEnd,
    ...dateTime
  }: DoMetricsRequestOptions
): Promise<MetricsApiResponse> => {
  const {start, end, statsPeriod} = normalizeDateTimeParams(dateTime, {
    allowEmptyPeriod: true,
  });

  const urlQuery = Object.fromEntries(
    Object.entries({
      field: field.filter(f => !!f),
      cursor,
      end,
      environment,
      groupBy,
      interval: interval || getInterval({start, end, period: statsPeriod}),
      query: query || undefined,
      per_page: limit,
      project,
      orderBy,
      start,
      statsPeriod,
      statsPeriodStart,
      statsPeriodEnd,
    }).filter(([, value]) => defined(value) && value !== '')
  );

  const pathname = `/organizations/${orgSlug}/metrics/data/`;

  return api.requestPromise(pathname, {includeAllArgs, query: urlQuery});
};

function tagFetchSuccess(tags: MetricTag[]) {
  MetricsTagActions.loadMetricsTagsSuccess(tags);
}

export function fetchMetricsTags(
  api: Client,
  orgSlug: Organization['slug'],
  projects?: number[],
  fields?: string[]
): Promise<MetricTag[]> {
  MetricsTagStore.reset();

  const promise = api.requestPromise(`/organizations/${orgSlug}/metrics/tags/`, {
    query: {
      project: projects,
      metric: fields,
    },
  });

  promise.then(tagFetchSuccess).catch(response => {
    const errorResponse = response?.responseJSON ?? t('Unable to fetch metric tags');
    addErrorMessage(errorResponse);
    handleXhrErrorResponse(errorResponse)(response);
  });

  return promise;
}

function metaFetchSuccess(metricsMeta: MetricMeta[]) {
  MetricsMetaActions.loadMetricsMetaSuccess(metricsMeta);
}

export function fetchMetricsFields(
  api: Client,
  orgSlug: Organization['slug'],
  projects?: number[]
): Promise<MetricMeta[]> {
  const promise: Promise<MetricMeta[]> = api.requestPromise(
    `/organizations/${orgSlug}/metrics/meta/`,
    {
      query: {
        project: projects,
      },
    }
  );

  promise.then(metaFetchSuccess).catch(response => {
    const errorResponse = response?.responseJSON ?? t('Unable to fetch metric fields');
    addErrorMessage(errorResponse);
    handleXhrErrorResponse(errorResponse)(response);
  });

  return promise;
}
