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
import Count from 'app/components/count';

import {
  TrendFunction,
  TrendChangeType,
  TrendView,
  TrendsTransaction,
  NormalizedTrendsTransaction,
  TrendFunctionField,
} from './types';

export const TRENDS_FUNCTIONS: TrendFunction[] = [
  {
    label: 'Average',
    field: TrendFunctionField.AVG,
    alias: 'avg_range',
  },
  {
    label: 'Duration (p50)',
    field: TrendFunctionField.P50,
    alias: 'percentile_range',
  },
  {
    label: 'User Misery',
    field: TrendFunctionField.USER_MISERY,
    alias: 'user_misery_range',
  },
];

/**
 * This function will increase the interval to help smooth trends
 */
export function chartIntervalFunction(dateTimeSelection: DateTimeObject) {
  const diffInMinutes = getDiffInMinutes(dateTimeSelection);
  if (diffInMinutes >= THIRTY_DAYS) {
    return '24h';
  }

  if (diffInMinutes >= TWO_WEEKS) {
    return '12h';
  }

  if (diffInMinutes >= ONE_WEEK) {
    return '6h';
  }

  if (diffInMinutes >= TWENTY_FOUR_HOURS) {
    return '30m';
  }

  if (diffInMinutes <= ONE_HOUR) {
    return '90s';
  }

  return '60s';
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

export function transformDeltaSpread(
  from: number,
  to: number,
  trendFunctionField: TrendFunctionField
) {
  const fromSeconds = from / 1000;
  const toSeconds = to / 1000;
  const fromSubSecond = fromSeconds < 1;
  const toSubSecond = toSeconds < 1;

  if (trendFunctionField === TrendFunctionField.USER_MISERY) {
    return (
      <span>
        <Count value={from} />
        {' → '}
        <Count value={to} /> {t('miserable users')}
      </span>
    );
  }

  return (
    <span>
      <Duration seconds={fromSeconds} fixedDigits={fromSubSecond ? 0 : 1} abbreviation />
      {' → '}
      <Duration seconds={toSeconds} fixedDigits={toSubSecond ? 0 : 1} abbreviation />
    </span>
  );
}

export function modifyTrendView(
  trendView: TrendView,
  location: Location,
  trendsType: TrendChangeType
) {
  const trendFunction = getCurrentTrendFunction(location);

  const trendFunctionFields = TRENDS_FUNCTIONS.map(({field}) => field);
  const fields = [...trendFunctionFields, 'transaction', 'project', 'count()'].map(
    field => ({
      field,
    })
  ) as Field[];

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
  const limitTrendResult = getLimitTransactionItems(trendFunction, trendsType);
  trendView.query += ' ' + limitTrendResult;

  trendView.interval = getQueryInterval(location, trendView);

  trendView.sorts = [trendSort];
  trendView.fields = fields;
}

function getQueryInterval(location: Location, eventView: TrendView) {
  const intervalFromQueryParam = decodeScalar(location?.query?.interval);
  const {start, end, statsPeriod} = eventView;

  const datetimeSelection = {
    start: start || null,
    end: end || null,
    period: statsPeriod,
  };

  const intervalFromSmoothing = chartIntervalFunction(datetimeSelection);

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

  const isSubSecond = seconds < 1;
  return (
    <span>
      <Duration seconds={seconds} fixedDigits={isSubSecond ? 0 : 1} abbreviation />{' '}
      {changeLabel}
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
      percentage_count_range_2_count_range_1,
    } = row;

    const aliasedFields = {} as NormalizedTrendsTransaction;
    TRENDS_FUNCTIONS.forEach(({alias}) => {
      if (typeof row[`${alias}_1`] !== 'undefined') {
        aliasedFields.aggregate_range_1 = row[`${alias}_1`];
        aliasedFields.aggregate_range_2 = row[`${alias}_2`];
        aliasedFields.percentage_aggregate_range_2_aggregate_range_1 =
          row[getTrendAliasedFieldPercentage(alias)];
        aliasedFields.minus_aggregate_range_2_aggregate_range_1 =
          row[getTrendAliasedMinus(alias)];
      }
    });

    return {
      ...aliasedFields,
      transaction,
      project,

      count_range_1,
      count_range_2,
      percentage_count_range_2_count_range_1,
    } as NormalizedTrendsTransaction;
  });
}

export function getTrendAliasedFieldPercentage(alias: string) {
  return `percentage_${alias}_2_${alias}_1`;
}

export function getTrendAliasedQueryPercentage(alias: string) {
  return `percentage(${alias}_2,${alias}_1)`;
}

export function getTrendAliasedMinus(alias: string) {
  return `minus_${alias}_2_${alias}_1`;
}

export function getSelectedQueryKey(trendChangeType: TrendChangeType) {
  return trendOffsetQueryKeys[trendChangeType];
}

/**
 * This function applies a query to limit the results based on the trend type to being greater or less than 100% (depending on the type)
 */
function getLimitTransactionItems(
  trendFunction: TrendFunction,
  trendChangeType: TrendChangeType
) {
  const aliasedPercentage = getTrendAliasedQueryPercentage(trendFunction.alias);
  let limitQuery = aliasedPercentage + ':<1';
  if (trendChangeType === TrendChangeType.REGRESSION) {
    limitQuery = aliasedPercentage + ':>1';
  }
  limitQuery +=
    ' percentage(count_range_2,count_range_1):>0.5 percentage(count_range_2,count_range_1):<2';
  return limitQuery;
}
