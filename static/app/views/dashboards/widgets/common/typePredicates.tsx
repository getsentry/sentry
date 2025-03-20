import {defined} from 'sentry/utils';
import {DurationUnit, RateUnit, SizeUnit} from 'sentry/utils/discover/fields';

import type {PlottableTimeSeriesValueType} from '../timeSeriesWidget/plottables/plottable';

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
export function isAUnitConvertibleFieldType(
  fieldType?: string
): fieldType is 'duration' | 'size' | 'rate' {
  return ['duration', 'size', 'rate'].includes(fieldType as unknown as string);
}

export function isAPlottableTimeSeriesValueType(
  timeSeriesValueType?: string | undefined | null
): timeSeriesValueType is PlottableTimeSeriesValueType {
  if (!defined(timeSeriesValueType)) {
    return false;
  }

  return (PLOTTABLE_TIME_SERIES_VALUE_TYPES as unknown as string[]).includes(
    timeSeriesValueType
  );
}
