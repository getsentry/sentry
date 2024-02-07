import {useCallback, useRef} from 'react';
import type {InjectedRouter} from 'react-router';
import moment from 'moment';
import * as qs from 'query-string';

import type {DateTimeObject, Fidelity} from 'sentry/components/charts/utils';
import {
  getDiffInMinutes,
  GranularityLadder,
  ONE_HOUR,
  ONE_WEEK,
  SIX_HOURS,
  SIXTY_DAYS,
  THIRTY_DAYS,
  TWENTY_FOUR_HOURS,
  TWO_WEEKS,
} from 'sentry/components/charts/utils';
import {
  normalizeDateTimeParams,
  parseStatsPeriod,
} from 'sentry/components/organizations/pageFilters/parse';
import {t} from 'sentry/locale';
import type {MetricsApiResponse, Organization, PageFilters} from 'sentry/types';
import type {
  MetricMeta,
  MetricsApiRequestMetric,
  MetricsApiRequestQuery,
  MetricsApiRequestQueryOptions,
  MetricsGroup,
  MetricsOperation,
  MRI,
  UseCase,
} from 'sentry/types/metrics';
import {statsPeriodToDays} from 'sentry/utils/dates';
import {isMeasurement as isMeasurementName} from 'sentry/utils/discover/fields';
import {generateEventSlug} from 'sentry/utils/discover/urls';
import {getMeasurements} from 'sentry/utils/measurements/measurements';
import {
  formatMRI,
  formatMRIField,
  getUseCaseFromMRI,
  MRIToField,
  parseField,
  parseMRI,
} from 'sentry/utils/metrics/mri';
import type {
  DdmQueryParams,
  MetricsQuery,
  MetricsQuerySubject,
  MetricWidgetQueryParams,
} from 'sentry/utils/metrics/types';
import {MetricDisplayType} from 'sentry/utils/metrics/types';
import {getTransactionDetailsUrl} from 'sentry/utils/performance/urls';
import useRouter from 'sentry/utils/useRouter';

export function getDefaultMetricDisplayType(
  mri: MetricsQuery['mri'],
  op: MetricsQuery['op']
): MetricDisplayType {
  if (mri?.startsWith('c') || op === 'count') {
    return MetricDisplayType.BAR;
  }
  return MetricDisplayType.LINE;
}

export const getMetricDisplayType = (displayType: unknown): MetricDisplayType => {
  if (
    [MetricDisplayType.AREA, MetricDisplayType.BAR, MetricDisplayType.LINE].includes(
      displayType as MetricDisplayType
    )
  ) {
    return displayType as MetricDisplayType;
  }

  return MetricDisplayType.LINE;
};

export function getDdmUrl(
  orgSlug: string,
  {
    widgets,
    start,
    end,
    statsPeriod,
    project,
    ...otherParams
  }: Omit<DdmQueryParams, 'project' | 'widgets'> & {
    widgets: MetricWidgetQueryParams[];
    project?: (string | number)[];
  }
) {
  const urlParams: Partial<DdmQueryParams> = {
    ...otherParams,
    project: project?.map(id => (typeof id === 'string' ? parseInt(id, 10) : id)),
    widgets: JSON.stringify(widgets),
  };

  if (statsPeriod) {
    urlParams.statsPeriod = statsPeriod;
  } else {
    urlParams.start = start;
    urlParams.end = end;
  }

  return `/organizations/${orgSlug}/ddm/?${qs.stringify(urlParams)}`;
}

export function getMetricsApiRequestQuery(
  {field, query, groupBy, orderBy}: MetricsApiRequestMetric,
  {projects, environments, datetime}: PageFilters,
  {fidelity, ...overrides}: Partial<MetricsApiRequestQueryOptions> = {}
): MetricsApiRequestQuery {
  const {mri: mri} = parseField(field) ?? {};
  const useCase = getUseCaseFromMRI(mri) ?? 'custom';
  const interval = getDDMInterval(datetime, useCase, fidelity);

  const hasGroupBy = groupBy && groupBy.length > 0;

  const queryToSend = {
    ...getDateTimeParams(datetime),
    query: sanitizeQuery(query),
    project: projects,
    environment: environments,
    field,
    useCase,
    interval,
    groupBy,
    orderBy: hasGroupBy && !orderBy && field ? `-${field}` : orderBy,
    useNewMetricsLayer: true,
  };

  return {...queryToSend, ...overrides};
}

function sanitizeQuery(query?: string) {
  return query?.trim();
}

const ddmHighFidelityLadder = new GranularityLadder([
  [SIXTY_DAYS, '1d'],
  [THIRTY_DAYS, '2h'],
  [TWO_WEEKS, '1h'],
  [ONE_WEEK, '30m'],
  [TWENTY_FOUR_HOURS, '5m'],
  [ONE_HOUR, '1m'],
  [0, '5m'],
]);

const ddmLowFidelityLadder = new GranularityLadder([
  [SIXTY_DAYS, '1d'],
  [THIRTY_DAYS, '12h'],
  [TWO_WEEKS, '4h'],
  [ONE_WEEK, '2h'],
  [TWENTY_FOUR_HOURS, '1h'],
  [SIX_HOURS, '30m'],
  [ONE_HOUR, '5m'],
  [0, '1m'],
]);

// Wraps getInterval since other users of this function, and other metric use cases do not have support for 10s granularity
export function getDDMInterval(
  datetimeObj: DateTimeObject,
  useCase: UseCase,
  fidelity: Fidelity = 'high'
) {
  const diffInMinutes = getDiffInMinutes(datetimeObj);

  if (diffInMinutes <= ONE_HOUR && useCase === 'custom' && fidelity === 'high') {
    return '10s';
  }

  if (fidelity === 'low') {
    return ddmLowFidelityLadder.getInterval(diffInMinutes);
  }

  return ddmHighFidelityLadder.getInterval(diffInMinutes);
}

export function getDateTimeParams({start, end, period}: PageFilters['datetime']) {
  return period
    ? {statsPeriod: period}
    : {start: moment(start).toISOString(), end: moment(end).toISOString()};
}

export function getDefaultMetricOp(mri: MRI): MetricsOperation {
  const parsedMRI = parseMRI(mri);
  switch (parsedMRI?.type) {
    case 'd':
    case 'g':
      return 'avg';
    case 's':
      return 'count_unique';
    case 'c':
    default:
      return 'sum';
  }
}

export function isAllowedOp(op: string) {
  return !['max_timestamp', 'min_timestamp', 'histogram'].includes(op);
}

// Applying these operations to a metric will result in a timeseries whose scale is different than
// the original metric. Becuase of that min and max bounds can't be used and we display the fog of war
export function isCumulativeOp(op: string = '') {
  return ['sum', 'count', 'count_unique'].includes(op);
}

function updateQuery(
  router: InjectedRouter,
  partialQuery: Record<string, any>,
  options?: {replace: boolean}
) {
  const updateFunction = options?.replace ? router.replace : router.push;
  updateFunction({
    ...router.location,
    query: {
      ...router.location.query,
      ...partialQuery,
    },
  });
}

export function clearQuery(router: InjectedRouter) {
  router.push({
    ...router.location,
    query: {},
  });
}

export function useInstantRef<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

export function useUpdateQuery() {
  const router = useRouter();
  // Store the router in a ref so that we can use it in the callback
  // without needing to generate a new callback every time the location changes
  const routerRef = useInstantRef(router);
  return useCallback(
    (partialQuery: Record<string, any>, options?: {replace: boolean}) => {
      updateQuery(routerRef.current, partialQuery, options);
    },
    [routerRef]
  );
}

export function useClearQuery() {
  const router = useRouter();
  // Store the router in a ref so that we can use it in the callback
  // without needing to generate a new callback every time the location changes
  const routerRef = useInstantRef(router);
  return useCallback(() => {
    clearQuery(routerRef.current);
  }, [routerRef]);
}

export function getMetricsSeriesName(group: MetricsGroup) {
  const groupByEntries = Object.entries(group.by ?? {});
  if (!groupByEntries.length) {
    const field = Object.keys(group.series)?.[0];
    const {mri} = parseField(field) ?? {mri: field};
    const name = formatMRI(mri as MRI);

    return name ?? '(none)';
  }

  return groupByEntries
    .map(([_key, value]) => `${String(value).length ? value : t('(none)')}`)
    .join(', ');
}

export function groupByOp(metrics: MetricMeta[]): Record<string, MetricMeta[]> {
  const uniqueOperations = [
    ...new Set(metrics.flatMap(field => field.operations).filter(isAllowedOp)),
  ].sort();

  const groupedByOp = uniqueOperations.reduce((result, op) => {
    result[op] = metrics.filter(field => field.operations.includes(op));
    return result;
  }, {});

  return groupedByOp;
}

export function isMeasurement({mri}: {mri: MRI}) {
  const {name} = parseMRI(mri) ?? {name: ''};
  return isMeasurementName(name);
}

export function isCustomMeasurement({mri}: {mri: MRI}) {
  const DEFINED_MEASUREMENTS = new Set(Object.keys(getMeasurements()));

  const {name} = parseMRI(mri) ?? {name: ''};
  return !DEFINED_MEASUREMENTS.has(name) && isMeasurementName(name);
}

export function isStandardMeasurement({mri}: {mri: MRI}) {
  return isMeasurement({mri}) && !isCustomMeasurement({mri});
}

export function isTransactionDuration({mri}: {mri: MRI}) {
  return mri === 'd:transactions/duration@millisecond';
}

export function isCustomMetric({mri}: {mri: MRI}) {
  return mri.includes(':custom/');
}

export function isSpanMetric({mri}: {mri: MRI}) {
  return mri.includes(':spans/');
}

export function getFieldFromMetricsQuery(metricsQuery: MetricsQuery) {
  if (isCustomMetric(metricsQuery)) {
    return MRIToField(metricsQuery.mri, metricsQuery.op!);
  }

  return formatMRIField(MRIToField(metricsQuery.mri, metricsQuery.op!));
}

// TODO(ddm): remove this and all of its usages once backend sends mri fields
export function mapToMRIFields(
  data: MetricsApiResponse | undefined,
  fields: string[]
): void {
  if (!data) {
    return;
  }

  data.groups.forEach(group => {
    group.series = swapObjectKeys(group.series, fields);
    group.totals = swapObjectKeys(group.totals, fields);
  });
}

function swapObjectKeys(obj: Record<string, unknown> | undefined, newKeys: string[]) {
  if (!obj) {
    return {};
  }

  return Object.keys(obj).reduce((acc, key, index) => {
    acc[newKeys[index]] = obj[key];
    return acc;
  }, {});
}

export function stringifyMetricWidget(metricWidget: MetricsQuerySubject): string {
  const {mri, op, query, groupBy} = metricWidget;

  if (!op) {
    return '';
  }

  let result = `${op}(${formatMRI(mri)})`;

  if (query) {
    result += `{${query.trim()}}`;
  }

  if (groupBy && groupBy.length) {
    result += ` by ${groupBy.join(', ')}`;
  }

  return result;
}

// TODO: consider moving this to utils/dates.tsx
export function getAbsoluteDateTimeRange(params: PageFilters['datetime']) {
  const {start, end, statsPeriod, utc} = normalizeDateTimeParams(params, {
    allowAbsoluteDatetime: true,
  });

  if (start && end) {
    return {start: moment(start).toISOString(), end: moment(end).toISOString()};
  }

  const parsedStatusPeriod = parseStatsPeriod(statsPeriod || '24h');

  const now = utc ? moment().utc() : moment();

  if (!parsedStatusPeriod) {
    // Default to 24h
    return {start: moment(now).subtract(1, 'day').toISOString(), end: now.toISOString()};
  }

  const startObj = moment(now).subtract(
    parsedStatusPeriod.period,
    parsedStatusPeriod.periodLength
  );

  return {start: startObj.toISOString(), end: now.toISOString()};
}

export function isSupportedDisplayType(displayType: unknown) {
  return Object.values(MetricDisplayType).includes(displayType as MetricDisplayType);
}

export function getMetricsCorrelationSpanUrl(
  organization: Organization,
  projectSlug: string | undefined,
  spanId: string | undefined,
  transactionId: string,
  transactionSpanId: string
) {
  const isTransaction = spanId === transactionSpanId;

  const eventSlug = generateEventSlug({
    id: transactionId,
    project: projectSlug,
  });

  return getTransactionDetailsUrl(
    organization.slug,
    eventSlug,
    isTransaction ? transactionId : undefined,
    {referrer: 'metrics', openPanel: 'open'},
    isTransaction ? undefined : spanId
  );
}

export function getMetaDateTimeParams(datetime?: PageFilters['datetime']) {
  if (datetime?.period) {
    if (statsPeriodToDays(datetime.period) < 14) {
      return {statsPeriod: '14d'};
    }
    return {statsPeriod: datetime.period};
  }
  if (datetime?.start && datetime?.end) {
    return {
      start: moment(datetime.start).toISOString(),
      end: moment(datetime.end).toISOString(),
    };
  }

  return {statsPeriod: '14d'};
}
