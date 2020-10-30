import React from 'react';
import {Location} from 'history';
import styled from '@emotion/styled';
import moment from 'moment';
import {ASAP} from 'downsample/methods/ASAP';

import theme from 'app/utils/theme';
import {getInterval} from 'app/components/charts/utils';
import {decodeScalar} from 'app/utils/queryString';
import Duration from 'app/components/duration';
import {Sort, Field} from 'app/utils/discover/fields';
import {t} from 'app/locale';
import space from 'app/styles/space';
import Count from 'app/components/count';
import {Organization, Project} from 'app/types';
import EventView from 'app/utils/discover/eventView';
import {Client} from 'app/api';
import {getUtcDateString, parsePeriodToHours} from 'app/utils/dates';
import {IconArrow} from 'app/icons';
import {Series, SeriesDataUnit} from 'app/types/echarts';

import {
  TrendFunction,
  ConfidenceLevel,
  TrendChangeType,
  TrendView,
  TrendsTransaction,
  NormalizedTrendsTransaction,
  TrendFunctionField,
  ProjectTrend,
  NormalizedProjectTrend,
} from './types';
import {BaselineQueryResults} from '../transactionSummary/baselineQuery';

export const DEFAULT_TRENDS_STATS_PERIOD = '14d';
export const DEFAULT_MAX_DURATION = '15min';

export const TRENDS_FUNCTIONS: TrendFunction[] = [
  {
    label: 'Duration (p50)',
    field: TrendFunctionField.P50,
    alias: 'percentile_range',
    chartLabel: 'p50()',
    legendLabel: 'p50',
  },
  {
    label: 'Duration (p75)',
    field: TrendFunctionField.P75,
    alias: 'percentile_range',
    chartLabel: 'p75()',
    legendLabel: 'p75',
  },
  {
    label: 'Duration (p95)',
    field: TrendFunctionField.P95,
    alias: 'percentile_range',
    chartLabel: 'p95()',
    legendLabel: 'p95',
  },
  {
    label: 'Duration (p99)',
    field: TrendFunctionField.P99,
    alias: 'percentile_range',
    chartLabel: 'p99()',
    legendLabel: 'p99',
  },
  {
    label: 'Duration (average)',
    field: TrendFunctionField.AVG,
    alias: 'avg_range',
    chartLabel: 'avg(transaction.duration)',
    legendLabel: 'average',
  },
];

export const CONFIDENCE_LEVELS: ConfidenceLevel[] = [
  {
    label: 'High',
    min: 6,
  },
  {
    label: 'Low',
    min: 0,
    max: 6,
  },
];

export const trendToColor = {
  [TrendChangeType.IMPROVED]: {
    lighter: theme.green300,
    default: theme.green400,
  },
  [TrendChangeType.REGRESSION]: {
    lighter: theme.red300,
    default: theme.red400,
  },
};

export const trendSelectedQueryKeys = {
  [TrendChangeType.IMPROVED]: 'improvedSelected',
  [TrendChangeType.REGRESSION]: 'regressionSelected',
};

export const trendCursorNames = {
  [TrendChangeType.IMPROVED]: 'improvedCursor',
  [TrendChangeType.REGRESSION]: 'regressionCursor',
};

export function resetCursors() {
  const cursors = {};
  Object.values(trendCursorNames).forEach(cursor => (cursors[cursor] = undefined)); // Resets both cursors
  return cursors;
}

export function getCurrentTrendFunction(location: Location): TrendFunction {
  const trendFunctionField = decodeScalar(location?.query?.trendFunction);
  const trendFunction = TRENDS_FUNCTIONS.find(({field}) => field === trendFunctionField);
  return trendFunction || TRENDS_FUNCTIONS[0];
}

export function getCurrentConfidenceLevel(location: Location): ConfidenceLevel {
  const confidenceLevelLabel = decodeScalar(location?.query?.confidenceLevel);
  const confidenceLevel = CONFIDENCE_LEVELS.find(
    ({label}) => label === confidenceLevelLabel
  );
  return confidenceLevel || CONFIDENCE_LEVELS[0];
}

export function getIntervalRatio(location: Location): number {
  const intervalFromLocation = decodeScalar(location?.query?.intervalRatio);
  return intervalFromLocation ? parseFloat(intervalFromLocation) : 0.5;
}

export function transformDeltaSpread(
  from: number,
  to: number,
  trendFunctionField: TrendFunctionField
) {
  const fromSeconds = from / 1000;
  const toSeconds = to / 1000;

  const showDigits = from > 1000 || to > 1000 || from < 10 || to < 10; // Show digits consistently if either has them

  if (trendFunctionField === TrendFunctionField.USER_MISERY) {
    return (
      <span>
        <Count value={from} />
        <StyledIconArrow direction="right" size="xs" />
        <Count value={to} /> {t('miserable users')}
      </span>
    );
  }

  return (
    <span>
      <Duration seconds={fromSeconds} fixedDigits={showDigits ? 1 : 0} abbreviation />
      <StyledIconArrow direction="right" size="xs" />
      <Duration seconds={toSeconds} fixedDigits={showDigits ? 1 : 0} abbreviation />
    </span>
  );
}

export function getTrendProjectId(
  trend: NormalizedTrendsTransaction | NormalizedProjectTrend,
  projects?: Project[]
): string | undefined {
  if (!trend.project || !projects) {
    return undefined;
  }
  const transactionProject = projects.find(project => project.slug === trend.project);
  return transactionProject?.id;
}

export function modifyTrendView(
  trendView: TrendView,
  location: Location,
  trendsType: TrendChangeType,
  isProjectOnly?: boolean
) {
  const trendFunction = getCurrentTrendFunction(location);
  const confidenceLevel = getCurrentConfidenceLevel(location);

  const transactionField = isProjectOnly ? [] : ['transaction'];
  const fields = [...transactionField, 'project'].map(field => ({
    field,
  })) as Field[];

  const trendSort = {
    field: `percentage_${trendFunction.alias}_2_${trendFunction.alias}_1`,
    kind: 'asc',
  } as Sort;

  if (trendFunction && trendFunction.field === TrendFunctionField.USER_MISERY) {
    trendSort.field = `minus_${trendFunction.alias}_2_${trendFunction.alias}_1`;
  }

  if (trendsType === TrendChangeType.REGRESSION) {
    trendSort.kind = 'desc';
  }

  if (trendFunction) {
    trendView.trendFunction = trendFunction.field;
  }
  const limitTrendResult = getLimitTransactionItems(trendsType, confidenceLevel);
  trendView.query += ' ' + limitTrendResult;

  trendView.interval = getQueryInterval(location, trendView);

  trendView.sorts = [trendSort];
  trendView.fields = fields;
}

export function modifyTrendsViewDefaultPeriod(eventView: EventView, location: Location) {
  const {query} = location;

  const hasStartAndEnd = query.start && query.end;

  if (!query.statsPeriod && !hasStartAndEnd) {
    eventView.statsPeriod = DEFAULT_TRENDS_STATS_PERIOD;
  }
  return eventView;
}

export async function getTrendBaselinesForTransaction(
  api: Client,
  organization: Organization,
  eventView: EventView,
  intervalRatio: number,
  transaction: NormalizedTrendsTransaction
) {
  const orgSlug = organization.slug;
  const url = `/organizations/${orgSlug}/event-baseline/`;

  const scopeQueryToTransaction = ` transaction:${transaction.transaction}`;

  const globalSelectionQuery = eventView.getGlobalSelectionQuery();
  const statsPeriod = eventView.statsPeriod;

  delete globalSelectionQuery.statsPeriod;
  const baseApiPayload = {
    ...globalSelectionQuery,
    query: eventView.query + scopeQueryToTransaction,
  };

  const hasStartEnd = eventView.start && eventView.end;

  let seriesStart = moment(eventView.start);
  let seriesEnd = moment(eventView.end);

  if (!hasStartEnd) {
    seriesEnd = transaction.received_at;
    seriesStart = seriesEnd
      .clone()
      .subtract(parsePeriodToHours(statsPeriod || DEFAULT_TRENDS_STATS_PERIOD), 'hours');
  }

  const startTime = seriesStart.toDate().getTime();
  const endTime = seriesEnd.toDate().getTime();

  const seriesSplit = moment(startTime + (endTime - startTime) * intervalRatio);

  const previousPeriodPayload = {
    ...baseApiPayload,
    start: getUtcDateString(seriesStart),
    end: getUtcDateString(seriesSplit),
    baselineValue: transaction.aggregate_range_1,
  };
  const currentPeriodPayload = {
    ...baseApiPayload,
    start: getUtcDateString(seriesSplit),
    end: getUtcDateString(seriesEnd),
    baselineValue: transaction.aggregate_range_2,
  };

  const dataPreviousPeriodPromise = api.requestPromise(url, {
    method: 'GET',
    query: previousPeriodPayload,
  });
  const dataCurrentPeriodPromise = api.requestPromise(url, {
    method: 'GET',
    query: currentPeriodPayload,
  });

  const previousPeriod = (await dataPreviousPeriodPromise) as BaselineQueryResults;
  const currentPeriod = (await dataCurrentPeriodPromise) as BaselineQueryResults;
  return {
    currentPeriod,
    previousPeriod,
  };
}

function getQueryInterval(location: Location, eventView: TrendView) {
  const intervalFromQueryParam = decodeScalar(location?.query?.interval);
  const {start, end, statsPeriod} = eventView;

  const datetimeSelection = {
    start: start || null,
    end: end || null,
    period: statsPeriod,
  };

  const intervalFromSmoothing = getInterval(datetimeSelection, true);

  return intervalFromQueryParam || intervalFromSmoothing;
}

export function transformValueDelta(
  value: number,
  trendType: TrendChangeType,
  trendFunctionField: TrendFunctionField
) {
  const absoluteValue = Math.abs(value);

  if (trendFunctionField === TrendFunctionField.USER_MISERY) {
    const changeLabel = trendType === TrendChangeType.REGRESSION ? t('more') : t('less');
    return (
      <span>
        <Count value={absoluteValue} /> {changeLabel}
      </span>
    );
  }
  const changeLabel =
    trendType === TrendChangeType.REGRESSION ? t('slower') : t('faster');

  const seconds = absoluteValue / 1000;

  const fixedDigits = absoluteValue > 1000 || absoluteValue < 10 ? 1 : 0;
  return (
    <span>
      <Duration seconds={seconds} fixedDigits={fixedDigits} abbreviation /> {changeLabel}
    </span>
  );
}

/**
 * This will normalize the trends transactions while the current trend function and current data are out of sync
 * To minimize extra renders with missing results.
 */
export function normalizeTrends(
  data: Array<TrendsTransaction>,
  trendFunction: TrendFunction
): Array<NormalizedTrendsTransaction>;

export function normalizeTrends(
  data: Array<ProjectTrend>,
  trendFunction: TrendFunction
): Array<NormalizedProjectTrend>;

export function normalizeTrends(
  data: Array<TrendsTransaction | ProjectTrend>,
  trendFunction: TrendFunction
): Array<NormalizedTrendsTransaction | NormalizedProjectTrend> {
  const received_at = moment(); // Adding the received time for the transaction so calls to get baseline always line up with the transaction
  return data.map(row => {
    const {
      project,
      count_range_1,
      count_range_2,
      percentage_count_range_2_count_range_1,
    } = row;

    const aliasedFields = {} as NormalizedTrendsTransaction;
    const alias = trendFunction.alias;
    aliasedFields.aggregate_range_1 = row[`${alias}_1`];
    aliasedFields.aggregate_range_2 = row[`${alias}_2`];
    aliasedFields.percentage_aggregate_range_2_aggregate_range_1 =
      row[getTrendAliasedFieldPercentage(alias)];
    aliasedFields.minus_aggregate_range_2_aggregate_range_1 =
      row[getTrendAliasedMinus(alias)];

    const normalized = {
      ...aliasedFields,
      project,

      count_range_1,
      count_range_2,
      percentage_count_range_2_count_range_1,
      received_at,
    };

    if ('transaction' in row) {
      return {
        ...normalized,
        transaction: row.transaction,
      } as NormalizedTrendsTransaction;
    } else {
      return {
        ...normalized,
      } as NormalizedProjectTrend;
    }
  });
}

export function getTrendAliasedFieldPercentage(alias: string) {
  return `percentage_${alias}_2_${alias}_1`;
}

export function getTrendAliasedMinus(alias: string) {
  return `minus_${alias}_2_${alias}_1`;
}

export function getSelectedQueryKey(trendChangeType: TrendChangeType) {
  return trendSelectedQueryKeys[trendChangeType];
}

export function movingAverage(data, index, size) {
  return (
    data
      .slice(index - size, index)
      .map(a => a.value)
      .reduce((a, b) => a + b, 0) / size
  );
}

/**
 * This function applies a query to limit the results based on the trend type to being greater or less than 100% (depending on the type)
 */
function getLimitTransactionItems(
  trendChangeType: TrendChangeType,
  confidenceLevel: ConfidenceLevel
) {
  let limitQuery = `trend_percentage():<1 t_test():>${confidenceLevel.min}`;
  limitQuery += confidenceLevel.max ? ` t_test():<=${confidenceLevel.max}` : '';
  if (trendChangeType === TrendChangeType.REGRESSION) {
    limitQuery = `trend_percentage():>1 t_test():<-${confidenceLevel.min}`;
    limitQuery += confidenceLevel.max ? ` t_test():>=-${confidenceLevel.max}` : '';
  }
  limitQuery +=
    ' percentage(count_range_2,count_range_1):>0.25 percentage(count_range_2,count_range_1):<4';
  return limitQuery;
}

export const smoothTrend = (data: [number, number][], resolution = 100) => {
  return ASAP(data, resolution);
};

export function transformEventStatsSmoothed(data?: Series[], seriesName?: string) {
  let minValue = Number.MAX_SAFE_INTEGER;
  let maxValue = 0;
  if (!data) {
    return {
      maxValue,
      minValue,
      smoothedResults: undefined,
    };
  }
  const currentData = data[0].data;
  const resultData: SeriesDataUnit[] = [];

  const smoothed = smoothTrend(currentData.map(({name, value}) => [Number(name), value]));

  for (let i = 0; i < smoothed.length; i++) {
    const point = smoothed[i] as any;
    const value = point.y;
    resultData.push({
      name: point.x,
      value,
    });
    if (!isNaN(value)) {
      const rounded = Math.round(value);
      minValue = Math.min(rounded, minValue);
      maxValue = Math.max(rounded, maxValue);
    }
  }

  return {
    minValue,
    maxValue,
    smoothedResults: [
      {
        seriesName: seriesName || 'Current',
        data: resultData,
      },
    ],
  };
}

export const StyledIconArrow = styled(IconArrow)`
  margin: 0 ${space(1)};
`;
