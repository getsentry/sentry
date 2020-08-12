import React from 'react';
import {Location} from 'history';

import theme from 'app/utils/theme';
import {
  getDiffInMinutes,
  THIRTY_DAYS,
  TWENTY_FOUR_HOURS,
  ONE_HOUR,
  DateTimeObject,
  ONE_WEEK,
  TWO_WEEKS,
} from 'app/components/charts/utils';
import {decodeScalar} from 'app/utils/queryString';
import Duration from 'app/components/duration';
import {Sort, Field} from 'app/utils/discover/fields';
import {t} from 'app/locale';

import {
  TrendFunction,
  TrendChangeType,
  TrendView,
  TrendsTransaction,
  NormalizedTrendsTransaction,
} from './types';

export const TRENDS_FUNCTIONS: TrendFunction[] = [
  {
    label: 'Duration (p50)',
    field: 'p50()',
    alias: 'percentile_range',
  },
  {
    label: 'Average',
    field: 'avg(transaction.duration)',
    alias: 'avg_range',
  },
  {
    label: 'User Misery',
    field: 'user_misery(300)',
    alias: 'user_misery_range',
  },
];

/**
 * This function will increase the interval to help smooth trends
 */
export function chartIntervalFunction(dateTimeSelection: DateTimeObject) {
  const diffInMinutes = getDiffInMinutes(dateTimeSelection);
  if (diffInMinutes >= THIRTY_DAYS) {
    return '48h';
  }

  if (diffInMinutes >= TWO_WEEKS) {
    return '24h';
  }

  if (diffInMinutes >= ONE_WEEK) {
    return '12h';
  }

  if (diffInMinutes >= TWENTY_FOUR_HOURS) {
    return '1h';
  }

  if (diffInMinutes <= ONE_HOUR) {
    return '180s';
  }

  return '2m';
}

export const trendToColor = {
  [TrendChangeType.IMPROVED]: theme.green400,
  [TrendChangeType.REGRESSION]: theme.red400,
};

export const trendOffsetQueryKeys = {
  [TrendChangeType.IMPROVED]: 'improvedOffset',
  [TrendChangeType.REGRESSION]: 'regressionOffset',
};

export function getCurrentTrendFunction(location: Location): TrendFunction {
  const trendFunctionField = decodeScalar(location?.query?.trendFunction);
  const trendFunction = TRENDS_FUNCTIONS.find(({field}) => field === trendFunctionField);
  return trendFunction || TRENDS_FUNCTIONS[0];
}

export function getIntervalRatio(location: Location): number {
  const intervalFromLocation = decodeScalar(location?.query?.intervalRatio);
  return intervalFromLocation ? parseFloat(intervalFromLocation) : 0.5;
}

export function transformDeltaSpread(from: number, to: number) {
  const fromSeconds = from / 1000;
  const toSeconds = to / 1000;
  const fromSubSecond = fromSeconds < 1;
  const toSubSecond = toSeconds < 1;
  return (
    <span>
      <Duration seconds={fromSeconds} fixedDigits={fromSubSecond ? 0 : 1} abbreviation />
      {' → '}
      <Duration seconds={toSeconds} fixedDigits={toSubSecond ? 0 : 1} abbreviation />
    </span>
  );
}

export function transformPercentage(ratio: number) {
  return `${(ratio * 100).toFixed(0)}%`;
}

export function modifyTrendView(
  trendView: TrendView,
  location: Location,
  trendsType: TrendChangeType
) {
  const trendFunction = getCurrentTrendFunction(location);
  const fields = ['transaction'].map(field => ({
    field,
  })) as Field[];

  const trendSort = {
    field: `divide_${trendFunction.alias}_2_${trendFunction.alias}_1`,
    kind: 'asc',
  } as Sort;

  if (trendFunction) {
    trendView.trendFunction = trendFunction.field;
  }
  if (trendsType === TrendChangeType.REGRESSION) {
    trendSort.kind = 'desc';
  }

  trendView.sorts = [trendSort];
  trendView.fields = fields;
}

export function transformDurationDelta(milliseconds: number, trendType: TrendChangeType) {
  const suffix = trendType === TrendChangeType.REGRESSION ? t('slower') : t('faster');

  const seconds = Math.abs(milliseconds) / 1000;

  const isSubSecond = seconds < 1;
  return (
    <span>
      <Duration seconds={seconds} fixedDigits={isSubSecond ? 0 : 1} abbreviation />{' '}
      {suffix}
    </span>
  );
}

/**
 * This will normalize the trends transactions while the current trend function and current data are out of sync
 * To minimize extra renders with missing results.
 */
export function normalizeTrendsTransactions(data: TrendsTransaction[]) {
  return data.map(row => {
    const {
      transaction,
      project,
      count_range_1,
      count_range_2,
      divide_count_range_2_count_range_1,
    } = row;

    const aliasedFields = {} as NormalizedTrendsTransaction;
    TRENDS_FUNCTIONS.forEach(({alias}) => {
      if (typeof row[`${alias}_1`] !== 'undefined') {
        aliasedFields.aggregate_range_1 = row[`${alias}_1`];
        aliasedFields.aggregate_range_2 = row[`${alias}_2`];
        aliasedFields.divide_aggregate_range_2_aggregate_range_1 =
          row[`divide_${alias}_2_${alias}_1`];
        aliasedFields.minus_aggregate_range_2_aggregate_range_1 =
          row[`minus_${alias}_2_${alias}_1`];
      }
    });

    return {
      ...aliasedFields,
      transaction,
      project,

      count_range_1,
      count_range_2,
      divide_count_range_2_count_range_1,
    } as NormalizedTrendsTransaction;
  });
}

export function getSelectedQueryKey(trendChangeType: TrendChangeType) {
  return trendOffsetQueryKeys[trendChangeType];
}
