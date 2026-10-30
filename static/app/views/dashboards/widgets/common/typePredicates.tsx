import {defined} from 'sentry/utils/defined';
import {
  DurationUnit,
  FractionUnit,
  RateUnit,
  SizeUnit,
} from 'sentry/utils/discover/fields';
import type {PlottableTimeSeriesValueType} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/plottable';

import {PLOTTABLE_TIME_SERIES_VALUE_TYPES} from './settings';

export function isADurationUnit(unit?: string): unit is DurationUnit {
  return Object.values(DurationUnit).includes(unit as unknown as DurationUnit);
}
export function isASizeUnit(unit?: string): unit is SizeUnit {
  return Object.values(SizeUnit).includes(unit as unknown as SizeUnit);
}
export function isARateUnit(unit?: string): unit is RateUnit {
  return Object.values(RateUnit).includes(unit as unknown as RateUnit);
}
export function isAFractionUnit(unit?: string): unit is FractionUnit {
  return Object.values(FractionUnit).includes(unit as unknown as FractionUnit);
}
export function isAUnitConvertibleFieldType(
  fieldType?: string
): fieldType is 'duration' | 'size' | 'rate' | 'percentage' {
  return ['duration', 'size', 'rate', 'percentage'].includes(
    fieldType as unknown as string
  );
}

export function isAPlottableTimeSeriesValueType(
  timeSeriesValueType?: string | null
): timeSeriesValueType is PlottableTimeSeriesValueType {
  if (!defined(timeSeriesValueType)) {
    return false;
  }

  return (PLOTTABLE_TIME_SERIES_VALUE_TYPES as unknown as string[]).includes(
    timeSeriesValueType
  );
}
