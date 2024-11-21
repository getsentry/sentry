import * as Sentry from '@sentry/react';
import startCase from 'lodash/startCase';
import moment from 'moment-timezone';

import type {TooltipSubLabel} from 'sentry/components/charts/components/tooltip';
import type {DataCategoryInfo, IntervalPeriod} from 'sentry/types/core';
import {Outcome} from 'sentry/types/core';

import {getDateFromMoment} from './usageChart/utils';
import {getReasonGroupName} from './getReasonGroupName';
import type {UsageSeries, UsageStat} from './types';
import type {ChartStats} from './usageChart';
import {SeriesTypes} from './usageChart';
import {formatUsageWithUnits, getFormatUsageOptions} from './utils';

export function mapSeriesToChart({
  orgStats,
  dataCategory,
  chartDateUtc,
  endpointQuery,
  chartDateInterval,
}: {
  chartDateInterval: IntervalPeriod;
  chartDateUtc: boolean;
  dataCategory: DataCategoryInfo['plural'];
  endpointQuery: Record<string, unknown>;
  orgStats?: UsageSeries;
}): {
  cardStats: {
    accepted?: string;
    accepted_stored?: string;
    filtered?: string;
    invalid?: string;
    rateLimited?: string;
    total?: string;
  };
  chartStats: ChartStats;
  chartSubLabels: TooltipSubLabel[];
  dataError?: Error;
} {
  const cardStats = {
    total: undefined,
    accepted: undefined,
    accepted_stored: undefined,
    filtered: undefined,
    invalid: undefined,
    rateLimited: undefined,
  };
  const chartStats: ChartStats = {
    accepted: [],
    accepted_stored: [],
    filtered: [],
    rateLimited: [],
    invalid: [],
    clientDiscard: [],
    projected: [],
  };
  let chartSubLabels: TooltipSubLabel[] = [];

  if (!orgStats) {
    return {cardStats, chartStats, chartSubLabels};
  }

  try {
    const usageStats: UsageStat[] = orgStats.intervals.map(interval => {
      const dateTime = moment(interval);

      return {
        date: getDateFromMoment(dateTime, chartDateInterval, chartDateUtc),
        total: 0,
        accepted: 0,
        accepted_stored: 0,
        filtered: 0,
        rateLimited: 0,
        invalid: 0,
        clientDiscard: 0,
      };
    });

    // Tally totals for card data
    const count = {
      total: 0,
      [Outcome.ACCEPTED]: 0,
      [Outcome.FILTERED]: 0,
      [Outcome.INVALID]: 0,
      [Outcome.RATE_LIMITED]: 0, // Combined with dropped later
      [Outcome.CLIENT_DISCARD]: 0,
      [Outcome.CARDINALITY_LIMITED]: 0, // Combined with dropped later
      [Outcome.ABUSE]: 0, // Combined with dropped later
    };

    let countAcceptedStored = 0;

    orgStats.groups.forEach(group => {
      const {outcome, category} = group.by;

      // For spans, we additionally query for `span_indexed` data
      // to get the `accepted_stored` count
      if (category !== 'span_indexed') {
        if (outcome !== Outcome.CLIENT_DISCARD) {
          count.total += group.totals['sum(quantity)'];
        }
        count[outcome] += group.totals['sum(quantity)'];
      } else {
        if (outcome === Outcome.ACCEPTED) {
          countAcceptedStored += group.totals['sum(quantity)'];
        }
      }

      if (category === 'span_indexed' && outcome !== Outcome.ACCEPTED) {
        // we need `span_indexed` data for `accepted_stored` only
        return;
      }

      group.series['sum(quantity)'].forEach((stat, i) => {
        const dataObject = {name: orgStats.intervals[i], value: stat};

        const strigfiedReason = String(group.by.reason ?? '');
        const reason = getReasonGroupName(outcome, strigfiedReason);

        // Function to handle chart sub-label updates
        const updateChartSubLabels = (
          parentLabel: SeriesTypes,
          label = startCase(reason.replace(/-|_/g, ' '))
        ) => {
          const existingSubLabel = chartSubLabels.find(
            subLabel => subLabel.label === label && subLabel.parentLabel === parentLabel
          );

          if (existingSubLabel) {
            // Check if the existing sub-label's data length matches the intervals length
            if (existingSubLabel.data.length === group.series['sum(quantity)'].length) {
              // Update the value of the current interval
              existingSubLabel.data[i].value += stat;
            } else {
              // Add a new data object if the length does not match
              existingSubLabel.data.push(dataObject);
            }
          } else {
            chartSubLabels.push({
              parentLabel,
              label,
              data: [dataObject],
            });
          }
        };

        // Add accepted indexed spans as sub-label to accepted
        if (category === 'span_indexed') {
          if (outcome === Outcome.ACCEPTED) {
            usageStats[i].accepted_stored += stat;
            updateChartSubLabels(SeriesTypes.ACCEPTED, 'Stored');
            return;
          }
        }

        switch (outcome) {
          case Outcome.FILTERED:
            usageStats[i].filtered += stat;
            updateChartSubLabels(SeriesTypes.FILTERED);
            break;
          case Outcome.ACCEPTED:
            usageStats[i].accepted += stat;
            break;
          case Outcome.CARDINALITY_LIMITED:
          case Outcome.RATE_LIMITED:
          case Outcome.ABUSE:
            usageStats[i].rateLimited += stat;
            updateChartSubLabels(SeriesTypes.RATE_LIMITED);
            break;
          case Outcome.CLIENT_DISCARD:
            usageStats[i].clientDiscard += stat;
            updateChartSubLabels(SeriesTypes.CLIENT_DISCARD);
            break;
          case Outcome.INVALID:
            usageStats[i].invalid += stat;
            updateChartSubLabels(SeriesTypes.INVALID);
            break;
          default:
            break;
        }
      });
    });

    // Combine rate limited counts
    count[Outcome.RATE_LIMITED] +=
      count[Outcome.ABUSE] + count[Outcome.CARDINALITY_LIMITED];

    const isSampled =
      dataCategory === 'spans' &&
      countAcceptedStored > 0 &&
      countAcceptedStored !== count[Outcome.ACCEPTED];

    usageStats.forEach(stat => {
      stat.total = [
        stat.accepted,
        stat.filtered,
        stat.rateLimited,
        stat.invalid,
        stat.clientDiscard,
      ].reduce((acc, val) => acc + val, 0);

      // Chart Data
      const chartData = [
        {
          key: 'accepted',
          value: stat.accepted,
        },
        ...(isSampled ? [{key: 'accepted_stored', value: stat.accepted_stored}] : []),
        {key: 'filtered', value: stat.filtered},
        {key: 'rateLimited', value: stat.rateLimited},
        {key: 'invalid', value: stat.invalid},
        {key: 'clientDiscard', value: stat.clientDiscard},
      ];

      chartData.forEach(data => {
        (chartStats[data.key] as any[]).push({value: [stat.date, data.value]});
      });
    });

    if (!isSampled) {
      chartSubLabels = chartSubLabels.filter(
        subLabel => subLabel.parentLabel !== SeriesTypes.ACCEPTED
      );
    }

    return {
      cardStats: {
        total: formatUsageWithUnits(
          count.total,
          dataCategory,
          getFormatUsageOptions(dataCategory)
        ),
        accepted: formatUsageWithUnits(
          count[Outcome.ACCEPTED],
          dataCategory,
          getFormatUsageOptions(dataCategory)
        ),
        accepted_stored: isSampled
          ? formatUsageWithUnits(
              countAcceptedStored,
              dataCategory,
              getFormatUsageOptions(dataCategory)
            )
          : undefined,
        filtered: formatUsageWithUnits(
          count[Outcome.FILTERED],
          dataCategory,
          getFormatUsageOptions(dataCategory)
        ),
        invalid: formatUsageWithUnits(
          count[Outcome.INVALID],
          dataCategory,
          getFormatUsageOptions(dataCategory)
        ),
        rateLimited: formatUsageWithUnits(
          count[Outcome.RATE_LIMITED],
          dataCategory,
          getFormatUsageOptions(dataCategory)
        ),
      },
      chartStats,
      chartSubLabels,
    };
  } catch (err) {
    Sentry.withScope(scope => {
      scope.setContext('query', endpointQuery);
      scope.setContext('body', {...orgStats});
      Sentry.captureException(err);
    });

    return {
      cardStats,
      chartStats,
      chartSubLabels,
      dataError: new Error('Failed to parse stats data'),
    };
  }
}
