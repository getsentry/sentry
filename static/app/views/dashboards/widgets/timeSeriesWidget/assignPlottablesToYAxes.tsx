import groupBy from 'lodash/groupBy';

import {uniq} from 'sentry/utils/array/uniq';
import type {AggregationOutputType} from 'sentry/utils/discover/fields';
import type {TimeSeriesValueUnit} from 'sentry/views/dashboards/widgets/common/types';

import type {Plottable} from './plottables/plottable';
import {FALLBACK_TYPE, FALLBACK_UNIT_FOR_FIELD_TYPE} from './settings';

type YAxisAssignment = {
  /**
   * Returns the side (`'left'` / `'right'`) a plottable should plot on.
   * Plottables whose data type wasn't seen during partitioning fall back to
   * the left axis so callers always get a usable position.
   */
  getYAxisPosition: (plottable: Plottable) => 'left' | 'right';
  /**
   * Data types assigned to the left axis. The first declared type anchors
   * this list; when only one data type is present everything is here.
   */
  leftYAxisDataTypes: string[];
  /**
   * Single representative type for the left axis. Falls back to
   * {@link FALLBACK_TYPE} when the left axis must carry multiple types.
   */
  leftYAxisType: string;
  /**
   * Data types assigned to the right axis. Empty when no right axis is
   * needed.
   */
  rightYAxisDataTypes: string[];
  /**
   * Single representative type for the right axis, or `undefined` when no
   * right axis is needed.
   */
  rightYAxisType: string | undefined;
  /**
   * Representative unit per data type. Used to build the axis label
   * formatters and to pass `unit` into each plottable's `toSeries` call.
   */
  unitForType: Record<string, TimeSeriesValueUnit>;
};

/**
 * Partitions plottables across left/right Y axes by data type. Used by both
 * the dashboard widget UI and the Slack dashboards-widget unfurl chartcuterie
 * chart so unfurls render multi-aggregate widgets (e.g. `count` +
 * `avg(duration)`) the same way the UI does.
 *
 * Rules (mirrors the legacy in-line logic in
 * `TimeSeriesWidgetVisualization`):
 *
 *   - 1 unique data type        -> single left axis
 *   - 2 unique data types       -> split, one per side
 *   - 3+ types, first = fallback -> all on left (avoid a fallback right axis)
 *   - 3+ types otherwise        -> first on left, the remainder share right
 */
export function assignPlottablesToYAxes(plottables: Plottable[]): YAxisAssignment {
  // Unique data types in order of first appearance — the first one anchors
  // the left axis.
  const axisTypes: string[] = [];
  for (const plottable of plottables) {
    const dataType = plottable.dataType ?? FALLBACK_TYPE;
    if (!axisTypes.includes(dataType)) {
      axisTypes.push(dataType);
    }
  }

  let leftYAxisDataTypes: string[] = [];
  let rightYAxisDataTypes: string[] = [];
  if (axisTypes.length <= 1) {
    leftYAxisDataTypes = axisTypes;
  } else if (axisTypes.length === 2) {
    leftYAxisDataTypes = axisTypes.slice(0, 1);
    rightYAxisDataTypes = axisTypes.slice(1, 2);
  } else if (axisTypes.at(0) === FALLBACK_TYPE) {
    leftYAxisDataTypes = axisTypes;
  } else {
    leftYAxisDataTypes = axisTypes.slice(0, 1);
    rightYAxisDataTypes = axisTypes.slice(1);
  }

  const leftYAxisType =
    leftYAxisDataTypes.length === 1 ? leftYAxisDataTypes[0]! : FALLBACK_TYPE;
  const rightYAxisType =
    rightYAxisDataTypes.length === 0
      ? undefined
      : rightYAxisDataTypes.length === 1
        ? rightYAxisDataTypes[0]!
        : FALLBACK_TYPE;

  // Pick a representative unit per data type. When plottables of the same
  // type disagree, fall back to the type's canonical unit so the axis
  // formatter stays consistent.
  const plottablesByType = groupBy(
    plottables,
    plottable => plottable.dataType ?? FALLBACK_TYPE
  );
  const unitForType: Record<string, TimeSeriesValueUnit> = {};
  for (const [type, ofType] of Object.entries(plottablesByType)) {
    const units = uniq(ofType.map(plottable => plottable.dataUnit));
    if (units.length === 1) {
      // Preserve the agreed-upon value even when it's `null` (a legitimate
      // "unitless" value). The original dashboard logic returned it as-is.
      unitForType[type] = units[0]!;
    } else {
      unitForType[type] =
        FALLBACK_UNIT_FOR_FIELD_TYPE[type as AggregationOutputType] ?? null;
    }
  }

  const getYAxisPosition = (plottable: Plottable): 'left' | 'right' => {
    const dataType = plottable.dataType ?? FALLBACK_TYPE;
    return rightYAxisDataTypes.includes(dataType) ? 'right' : 'left';
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
