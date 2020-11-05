import React from 'react';
import {Location} from 'history';
import styled from '@emotion/styled';
import moment from 'moment';
import {ASAP} from 'downsample/methods/ASAP';

import theme from 'app/utils/theme';
import {getInterval} from 'app/components/charts/utils';
import {decodeScalar} from 'app/utils/queryString';
import {tokenizeSearch} from 'app/utils/tokenizeSearch';
import Duration from 'app/components/duration';
import {Sort, Field} from 'app/utils/discover/fields';
import {t} from 'app/locale';
import space from 'app/styles/space';
import Count from 'app/components/count';
import {Project} from 'app/types';
import EventView from 'app/utils/discover/eventView';
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
} from './types';

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
  {
    label: 'Any',
  },
];

export const trendToColor = {
  [TrendChangeType.IMPROVED]: {
    lighter: theme.green200,
    default: theme.green300,
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

export const trendUnselectedSeries = {
  [TrendChangeType.IMPROVED]: 'improvedUnselectedSeries',
  [TrendChangeType.REGRESSION]: 'regressionUnselectedSeries',
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
  trend: NormalizedTrendsTransaction,
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
    field: 'trend_percentage()',
    kind: 'asc',
  } as Sort;

  if (trendFunction && trendFunction.field === TrendFunctionField.USER_MISERY) {
    trendSort.field = `minus_${trendFunction.alias}_2_${trendFunction.alias}_1`;
  }

  trendView.trendType = trendsType;
  if (trendsType === TrendChangeType.REGRESSION) {
    trendSort.kind = 'desc';
  }

  if (trendFunction) {
    trendView.trendFunction = trendFunction.field;
  }
  trendView.query = getLimitTransactionItems(
    trendView.query,
    trendsType,
    confidenceLevel
  );

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
  data: Array<TrendsTransaction>
): Array<NormalizedTrendsTransaction> {
  const received_at = moment(); // Adding the received time for the transaction so calls to get baseline always line up with the transaction
  return data.map(row => {
    return {
      ...row,
      received_at,
      transaction: row.transaction,
    } as NormalizedTrendsTransaction;
  });
}

export function getSelectedQueryKey(trendChangeType: TrendChangeType) {
  return trendSelectedQueryKeys[trendChangeType];
}

export function getUnselectedSeries(trendChangeType: TrendChangeType) {
  return trendUnselectedSeries[trendChangeType];
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
 * This function applies defaults for trend and count percentage, and adds the confidence limit to the query
 */
function getLimitTransactionItems(
  query: string,
  trendChangeType: TrendChangeType,
  confidenceLevel: ConfidenceLevel
) {
  const limitQuery = tokenizeSearch(query);
  if (!limitQuery.hasTag('count_percentage()')) {
    limitQuery.addTagValues('count_percentage()', ['>0.25', '<4']);
  }
  if (!limitQuery.hasTag('trend_percentage()')) {
    limitQuery.addTagValues('trend_percentage()', ['>0%']);
  }
  if (!limitQuery.hasTag('t_test()')) {
    const tagValues: string[] = [];
    if (trendChangeType === TrendChangeType.REGRESSION) {
      if (confidenceLevel.hasOwnProperty('min')) {
        tagValues.push(`<-${confidenceLevel.min}`);
      }
      if (confidenceLevel.hasOwnProperty('max')) {
        tagValues.push(`>=-${confidenceLevel.max}`);
      }
    } else {
      if (confidenceLevel.hasOwnProperty('min')) {
        tagValues.push(`>${confidenceLevel.min}`);
      }
      if (confidenceLevel.hasOwnProperty('max')) {
        tagValues.push(`<=${confidenceLevel.max}`);
      }
    }
    limitQuery.addTagValues('t_test()', tagValues);
  }
  return limitQuery.formatString();
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
