import * as Sentry from '@sentry/react';
import groupBy from 'lodash/groupBy';
import mapValues from 'lodash/mapValues';

import {uniq} from 'sentry/utils/array/uniq';
import type {AggregationOutputType} from 'sentry/utils/discover/fields';
import type {TimeSeriesValueUnit} from 'sentry/views/dashboards/widgets/common/types';

import type {Plottable} from './plottables/plottable';
import {FALLBACK_TYPE, FALLBACK_UNIT_FOR_FIELD_TYPE} from './settings';

const {error} = Sentry.logger;

type YAxisAssignment = {
  /**
   * Returns the side (`'left'` / `'right'`) a plottable should plot on.
   * Logs to Sentry when a plottable's data type wasn't seen during
   * partitioning, mirroring the original in-line behavior.
   */
  getYAxisPosition: (plottable: Plottable) => 'left' | 'right';
  leftYAxisDataTypes: string[];
  leftYAxisType: string;
  rightYAxisDataTypes: string[];
  rightYAxisType: string | undefined;
  unitForType: Record<string, TimeSeriesValueUnit>;
};

/**
 * Partitions plottables across left/right Y axes by data type. Used by both
 * `TimeSeriesWidgetVisualization` and the Slack dashboards-widget unfurl
 * chartcuterie chart so unfurls render multi-aggregate widgets the same way
 * the UI does.
 */
export function assignPlottablesToYAxes(plottables: Plottable[]): YAxisAssignment {
  const plottablesByType = groupBy(plottables, plottable => plottable.dataType);

  // Get unique axis types in order of first appearance, treating the first
  // aggregate as primary. This avoids axis flipping when thresholds or other
  // plottables inflate the count of a particular data type.
  const axisTypes: string[] = [];
  for (const plottable of plottables) {
    if (plottable.dataType && !axisTypes.includes(plottable.dataType)) {
      axisTypes.push(plottable.dataType);
    }
  }

  // Partition the types between the two axes
  let leftYAxisDataTypes: string[] = [];
  let rightYAxisDataTypes: string[] = [];

  if (axisTypes.length === 1) {
    // The simplest case, there is just one type. Assign it to the left axis
    leftYAxisDataTypes = axisTypes;
  } else if (axisTypes.length === 2) {
    // Also a simple case. If there are only two types, split them evenly
    leftYAxisDataTypes = axisTypes.slice(0, 1);
    rightYAxisDataTypes = axisTypes.slice(1, 2);
  } else if (axisTypes.length > 2 && axisTypes.at(0) === FALLBACK_TYPE) {
    // There are multiple types, and the first one is the fallback. Don't
    // bother creating a second fallback axis, plot everything on the left
    leftYAxisDataTypes = axisTypes;
  } else {
    // There are multiple types. Assign the first type to the left axis,
    // the rest to the right axis
    leftYAxisDataTypes = axisTypes.slice(0, 1);
    rightYAxisDataTypes = axisTypes.slice(1);
  }

  // The left Y axis might be responsible for 1 or more types. If there's just
  // one, use that type. If it's responsible for more than 1 type, use the
  // fallback type
  const leftYAxisType =
    leftYAxisDataTypes.length === 1 ? leftYAxisDataTypes.at(0)! : FALLBACK_TYPE;

  // The right Y axis might be responsible for 0, 1, or more types. If there are
  // none, don't set a type at all. If there is 1, use that type. If there are
  // two or more, use fallback type
  const rightYAxisType =
    rightYAxisDataTypes.length === 0
      ? undefined
      : rightYAxisDataTypes.length === 1
        ? rightYAxisDataTypes.at(0)
        : FALLBACK_TYPE;

  // Create a map of used units by plottable data type
  const unitsByType = mapValues(plottablesByType, ofType =>
    uniq(ofType.map(plottable => plottable.dataUnit))
  );

  // Narrow down to just one unit for each plottable data type
  const unitForType = mapValues(unitsByType, (relevantUnits, type) => {
    if (relevantUnits.length === 1) {
      // All plottables of this type have the same unit
      return relevantUnits[0]!;
    }

    if (relevantUnits.length === 0) {
      // None of the plottables of this type supplied a unit
      return FALLBACK_UNIT_FOR_FIELD_TYPE[type as AggregationOutputType];
    }

    // Plottables of this type has mismatched units. Return a fallback. It
    // would also be acceptable to return the unit of the _first_ plottable,
    // probably
    return FALLBACK_UNIT_FOR_FIELD_TYPE[type as AggregationOutputType];
  });

  const getYAxisPosition = (plottable: Plottable): 'left' | 'right' => {
    let yAxisPosition: 'left' | 'right' = 'left';

    if (leftYAxisDataTypes.includes(plottable.dataType)) {
      // This plottable is assigned to the left axis
      yAxisPosition = 'left';
    } else if (rightYAxisDataTypes.includes(plottable.dataType)) {
      // This plottable is assigned to the right axis
      yAxisPosition = 'right';
    } else {
      // This plottable's type isn't assignned to either axis! Mysterious.
      // There's no graceful way to handle this.
      Sentry.withScope(scope => {
        const message =
          '`TimeSeriesWidgetVisualization` Could not assign Plottable to an axis';

        scope.setFingerprint(['could-not-assign-plottable-to-an-axis']);
        Sentry.captureException(new Error(message));

        error(message, {
          dataType: plottable.dataType,
          leftAxisType: leftYAxisType,
          rightAxisType: rightYAxisType,
        });
      });
    }

    return yAxisPosition;
  };

  return {
    leftYAxisDataTypes,
    rightYAxisDataTypes,
    leftYAxisType,
    rightYAxisType,
    unitForType,
    getYAxisPosition,
  };
}
