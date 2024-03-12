import {useCallback, useRef} from 'react';
import type {InjectedRouter} from 'react-router';
import moment from 'moment';
import * as qs from 'query-string';

import type {DateTimeObject} from 'sentry/components/charts/utils';
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
import type {Organization, PageFilters} from 'sentry/types';
import type {
  MetricMeta,
  MetricsDataIntervalLadder,
  MetricsOperation,
  MRI,
  UseCase,
} from 'sentry/types/metrics';
import {statsPeriodToDays} from 'sentry/utils/dates';
import {isMeasurement} from 'sentry/utils/discover/fields';
import {generateEventSlug} from 'sentry/utils/discover/urls';
import {getMeasurements} from 'sentry/utils/measurements/measurements';
import {formatMRI, formatMRIField, MRIToField, parseMRI} from 'sentry/utils/metrics/mri';
import type {
  DdmQueryParams,
  MetricsQuery,
  MetricWidgetQueryParams,
} from 'sentry/utils/metrics/types';
import {MetricDisplayType} from 'sentry/utils/metrics/types';
import {
  isMetricFormula,
  type MetricsQueryApiQueryParams,
} from 'sentry/utils/metrics/useMetricsQuery';
import {getTransactionDetailsUrl} from 'sentry/utils/performance/urls';
import useRouter from 'sentry/utils/useRouter';

export function getDefaultMetricDisplayType(
  mri?: MetricsQuery['mri'],
  op?: MetricsQuery['op']
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
    widgets: Partial<MetricWidgetQueryParams>[];
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

const intervalLadders: Record<MetricsDataIntervalLadder, GranularityLadder> = {
  ddm: new GranularityLadder([
    [SIXTY_DAYS, '1d'],
    [THIRTY_DAYS, '2h'],
    [TWO_WEEKS, '1h'],
    [ONE_WEEK, '30m'],
    [TWENTY_FOUR_HOURS, '5m'],
    [ONE_HOUR, '1m'],
    [0, '1m'],
  ]),
  bar: new GranularityLadder([
    [SIXTY_DAYS, '1d'],
    [THIRTY_DAYS, '12h'],
    [TWO_WEEKS, '4h'],
    [ONE_WEEK, '2h'],
    [TWENTY_FOUR_HOURS, '1h'],
    [SIX_HOURS, '30m'],
    [ONE_HOUR, '5m'],
    [0, '1m'],
  ]),
  dashboard: new GranularityLadder([
    [SIXTY_DAYS, '1d'],
    [THIRTY_DAYS, '1h'],
    [TWO_WEEKS, '30m'],
    [ONE_WEEK, '30m'],
    [TWENTY_FOUR_HOURS, '5m'],
    [0, '5m'],
  ]),
};

// Wraps getInterval since other users of this function, and other metric use cases do not have support for 10s granularity
export function getDDMInterval(
  datetimeObj: DateTimeObject,
  useCase: UseCase,
  ladder: MetricsDataIntervalLadder = 'ddm'
) {
  const diffInMinutes = getDiffInMinutes(datetimeObj);

  if (diffInMinutes <= ONE_HOUR && useCase === 'custom' && ladder === 'ddm') {
    return '10s';
  }

  return intervalLadders[ladder].getInterval(diffInMinutes);
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

export function unescapeMetricsFormula(formula: string) {
  // Remove the $ from variable names
  return formula.replaceAll('$', '');
}

export function getMetricsSeriesName(
  query: MetricsQueryApiQueryParams,
  groupBy?: Record<string, string>,
  isMultiQuery: boolean = true
) {
  let name = '';
  if (isMetricFormula(query)) {
    name = unescapeMetricsFormula(query.formula);
  } else {
    name = formatMRIField(MRIToField(query.mri, query.op));
  }

  if (isMultiQuery) {
    name = `${query.name}: ${name}`;
  }

  const groupByEntries = Object.entries(groupBy ?? {});

  if (!groupByEntries || !groupByEntries.length) {
    return name;
  }

  const formattedGrouping = groupByEntries
    .map(([_key, value]) => `${String(value).length ? value : t('(none)')}`)
    .join(', ');

  if (isMultiQuery) {
    return `${name} - ${formattedGrouping}`;
  }
  return formattedGrouping;
}

export function getMetricsSeriesId(
  query: MetricsQueryApiQueryParams,
  groupBy?: Record<string, string>
) {
  if (Object.keys(groupBy ?? {}).length === 0) {
    return `${query.name}`;
  }
  return `${query.name}-${JSON.stringify(groupBy)}`;
}

export function getQueryName(seriesId: string) {
  return seriesId.split('-')[0];
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

export function isTransactionMeasurement({mri}: {mri: MRI}) {
  const {name} = parseMRI(mri) ?? {name: ''};
  return isMeasurement(name);
}

export function isSpanMeasurement({mri}: {mri: MRI}) {
  if (
    mri === 'd:spans/http.response_content_length@byte' ||
    mri === 'd:spans/http.decoded_response_content_length@byte' ||
    mri === 'd:spans/http.response_transfer_size@byte'
  ) {
    return true;
  }

  const parsedMRI = parseMRI(mri);
  if (
    parsedMRI &&
    parsedMRI.useCase === 'spans' &&
    parsedMRI.name.startsWith('webvital.')
  ) {
    return true;
  }

  return false;
}

export function isCustomMeasurement({mri}: {mri: MRI}) {
  const DEFINED_MEASUREMENTS = new Set(Object.keys(getMeasurements()));

  const {name} = parseMRI(mri) ?? {name: ''};
  return !DEFINED_MEASUREMENTS.has(name) && isMeasurement(name);
}

export function isStandardMeasurement({mri}: {mri: MRI}) {
  return isTransactionMeasurement({mri}) && !isCustomMeasurement({mri});
}

export function isTransactionDuration({mri}: {mri: MRI}) {
  return mri === 'd:transactions/duration@millisecond';
}

export function isCustomMetric({mri}: {mri: MRI}) {
  return mri.includes(':custom/');
}

export function isSpanSelfTime({mri}: {mri: MRI}) {
  return mri === 'd:spans/exclusive_time@millisecond';
}

export function getFieldFromMetricsQuery(metricsQuery: MetricsQuery) {
  if (isCustomMetric(metricsQuery)) {
    return MRIToField(metricsQuery.mri, metricsQuery.op);
  }

  return formatMRIField(MRIToField(metricsQuery.mri, metricsQuery.op));
}

export function getFormattedMQL({mri, op, query, groupBy}: MetricsQuery): string {
  if (!op) {
    return '';
  }

  let result = `${op}(${formatMRI(mri)})`;

  if (query) {
    result += `{${query.trim()}}`;
  }

  if (groupBy?.length) {
    result += ` by ${groupBy.join(', ')}`;
  }

  return result;
}

export function isFormattedMQL(mql: string) {
  const regex = /^(\w+\([\w\.]+\))(?:\{\w+\:\w+\})*(?:\sby\s\w+)*/;

  const matches = mql.match(regex);

  const [, field, query, groupBy] = matches ?? [];

  if (!field) {
    return false;
  }

  if (query) {
    return query.includes(':');
  }

  if (groupBy) {
    // TODO check groupbys
  }

  return true;
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
