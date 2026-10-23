import * as Sentry from '@sentry/react';
import startCase from 'lodash/startCase';
import moment from 'moment-timezone';

import type {TooltipSubLabel} from 'sentry/components/charts/components/tooltip';
import {DATA_CATEGORY_INFO} from 'sentry/constants';
import {t, tn} from 'sentry/locale';
import type {DataCategory, IntervalPeriod} from 'sentry/types/core';
import {Outcome} from 'sentry/types/core';

import {getDateFromMoment, getTooltipFormatter} from './usageChart/utils';
import {getReasonGroupName} from './getReasonGroupName';
import type {UsageSeries, UsageStat} from './types';
import type {ChartStats} from './usageChart';
import {SeriesTypes} from './usageChart';
import {formatUsageWithUnits, getFormatUsageOptions} from './utils';

/**
 * Not every SDK reports client discards for byte categories, but all of them
 * report the number of discarded items. For these byte categories, we also query
 * the item count category to show those client discards.
 */
export const CLIENT_DISCARD_COUNT_CATEGORIES = [
  {
    bytes: DATA_CATEGORY_INFO.log_byte,
    count: DATA_CATEGORY_INFO.log_item,
    countUnit: (count: number) => tn('log', 'logs', count),
  },
  {
    bytes: DATA_CATEGORY_INFO.trace_metric_byte,
    count: DATA_CATEGORY_INFO.trace_metric,
    countUnit: (count: number) => tn('application metric', 'application metrics', count),
  },
];

export function mapSeriesToChart({
  orgStats,
  dataCategory,
  chartDateUtc,
  endpointQuery,
  chartDateInterval,
}: {
  chartDateInterval: IntervalPeriod;
  chartDateUtc: boolean;
  dataCategory: DataCategory;
  endpointQuery: Record<string, unknown>;
  orgStats?: UsageSeries;
}): {
  cardStats: {
    accepted?: string;
    accepted_stored?: string;
    clientDiscard?: string;
    filtered?: string;
    invalid?: string;
    rateLimited?: string;
    total?: string;
  };
  chartStats: ChartStats;
  chartSubLabels: TooltipSubLabel[];
  /**
   * Set when the client discard series holds item counts of this category
   * instead of values of `dataCategory`.
   */
  clientDiscardCountCategory?: DataCategory;
  dataError?: Error;
} {
  const cardStats = {
    total: undefined,
    accepted: undefined,
    accepted_stored: undefined,
    filtered: undefined,
    invalid: undefined,
    rateLimited: undefined,
    clientDiscard: undefined,
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

  const clientDiscardCountInfo = CLIENT_DISCARD_COUNT_CATEGORIES.find(
    ({bytes}) => bytes.plural === dataCategory
  );
  const countCategory = clientDiscardCountInfo?.count;
  const clientDiscardCounts = orgStats.intervals.map(() => 0);
  let clientDiscardCountTotal = 0;
  const clientDiscardCountSubLabels: TooltipSubLabel[] = [];

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

      if (outcome === Outcome.CLIENT_DISCARD && group.by.reason === 'no_parent_span') {
        return;
      }

      // We only need client discards from the item count category
      const isClientDiscardCount = countCategory && category === countCategory.name;
      if (isClientDiscardCount && outcome !== Outcome.CLIENT_DISCARD) {
        return;
      }

      // For spans, we additionally query for `span_indexed` data
      // to get the `accepted_stored` count
      if (category === 'span_indexed') {
        if (outcome === Outcome.ACCEPTED) {
          countAcceptedStored += group.totals['sum(quantity)']!;
        }
      } else if (isClientDiscardCount) {
        clientDiscardCountTotal += group.totals['sum(quantity)']!;
      } else {
        if (outcome !== Outcome.CLIENT_DISCARD) {
          count.total += group.totals['sum(quantity)']!;
        }
        (count as any)[outcome!] += group.totals['sum(quantity)']!;
      }

      if (category === 'span_indexed' && outcome !== Outcome.ACCEPTED) {
        // we need `span_indexed` data for `accepted_stored` only
        return;
      }

      group.series['sum(quantity)']!.forEach((stat, i) => {
        const dataObject = {name: orgStats.intervals[i]!, value: stat};

        const strigfiedReason = String(group.by.reason ?? '');
        const reason = getReasonGroupName(outcome!, strigfiedReason);
        const reasonLabel = startCase(reason.replace(/-|_/g, ' '));

        // Function to handle chart sub-label updates
        const updateChartSubLabels = (
          parentLabel: SeriesTypes,
          label = reasonLabel,
          subLabels = chartSubLabels,
          subLabelOptions?: Pick<TooltipSubLabel, 'excludeFromTotal' | 'valueFormatter'>
        ) => {
          const existingSubLabel = subLabels.find(
            subLabel => subLabel.label === label && subLabel.parentLabel === parentLabel
          );

          if (existingSubLabel) {
            // Check if the existing sub-label's data length matches the intervals length
            if (existingSubLabel.data.length === group.series['sum(quantity)']!.length) {
              // Update the value of the current interval
              existingSubLabel.data[i]!.value += stat;
            } else {
              // Add a new data object if the length does not match
              existingSubLabel.data.push(dataObject);
            }
          } else {
            subLabels.push({
              parentLabel,
              label,
              data: [dataObject],
              ...subLabelOptions,
            });
          }
        };

        // Add accepted indexed spans as sub-label to accepted
        if (category === 'span_indexed') {
          if (outcome === Outcome.ACCEPTED) {
            usageStats[i]!.accepted_stored += stat;
            updateChartSubLabels(SeriesTypes.ACCEPTED, 'Stored');
            return;
          }
        }

        switch (outcome) {
          case Outcome.FILTERED:
            usageStats[i]!.filtered += stat;
            updateChartSubLabels(SeriesTypes.FILTERED);
            break;
          case Outcome.ACCEPTED:
            usageStats[i]!.accepted += stat;
            break;
          case Outcome.CARDINALITY_LIMITED:
          case Outcome.RATE_LIMITED:
          case Outcome.ABUSE:
            usageStats[i]!.rateLimited += stat;
            updateChartSubLabels(SeriesTypes.RATE_LIMITED);
            break;
          case Outcome.CLIENT_DISCARD:
            if (isClientDiscardCount) {
              clientDiscardCounts[i]! += stat;
              updateChartSubLabels(
                SeriesTypes.CLIENT_DISCARD,
                t('%s (Count)', reasonLabel),
                clientDiscardCountSubLabels,
                {
                  excludeFromTotal: true,
                  valueFormatter: getTooltipFormatter(countCategory.plural),
                }
              );
            } else {
              usageStats[i]!.clientDiscard += stat;
              updateChartSubLabels(SeriesTypes.CLIENT_DISCARD);
            }
            break;
          case Outcome.INVALID:
            usageStats[i]!.invalid += stat;
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

    // Chart client discards in item counts only if there are none in the selected category
    const chartedClientDiscardCountInfo =
      count[Outcome.CLIENT_DISCARD] === 0 && clientDiscardCountTotal > 0
        ? clientDiscardCountInfo
        : undefined;
    const clientDiscardCountCategory = chartedClientDiscardCountInfo?.count.plural;

    usageStats.forEach((stat, i) => {
      if (clientDiscardCountCategory) {
        stat.clientDiscard = clientDiscardCounts[i]!;
      }

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
        ((chartStats as any)[data.key] as any[]).push({value: [stat.date, data.value]});
      });
    });

    if (!isSampled) {
      chartSubLabels = chartSubLabels.filter(
        subLabel => subLabel.parentLabel !== SeriesTypes.ACCEPTED
      );
    }

    chartSubLabels.push(...clientDiscardCountSubLabels);

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
        // Spell out the unit, so the count can't be mistaken for a size
        clientDiscard: chartedClientDiscardCountInfo
          ? `${formatUsageWithUnits(
              clientDiscardCountTotal,
              chartedClientDiscardCountInfo.count.plural,
              getFormatUsageOptions(chartedClientDiscardCountInfo.count.plural)
            )} ${chartedClientDiscardCountInfo.countUnit(clientDiscardCountTotal)}`
          : formatUsageWithUnits(
              count[Outcome.CLIENT_DISCARD],
              dataCategory,
              getFormatUsageOptions(dataCategory)
            ),
      },
      chartStats,
      chartSubLabels,
      clientDiscardCountCategory,
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
