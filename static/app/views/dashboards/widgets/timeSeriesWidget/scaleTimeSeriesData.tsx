import * as Sentry from '@sentry/react';

import {
  type AggregationOutputType,
  DurationUnit,
  RateUnit,
  SizeUnit,
} from 'sentry/utils/discover/fields';
import {convertDuration} from 'sentry/utils/unitConversion/convertDuration';
import {convertRate} from 'sentry/utils/unitConversion/convertRate';
import {convertSize} from 'sentry/utils/unitConversion/convertSize';

import {
  isADurationUnit,
  isARateUnit,
  isASizeUnit,
  isAUnitConvertibleFieldType,
} from '../common/typePredicates';
import type {TimeseriesData} from '../common/types';

import {FALLBACK_TYPE} from './timeSeriesWidgetVisualization';

export function scaleTimeSeriesData(
  timeserie: Readonly<TimeseriesData>,
  destinationUnit: DurationUnit | SizeUnit | RateUnit | null
): TimeseriesData {
  // TODO: Instead of a fallback, allow this to be `null`, which might happen
  const sourceType =
    (timeserie.meta?.fields[timeserie.field] as AggregationOutputType) ??
    (FALLBACK_TYPE as AggregationOutputType);

  // Don't bother trying to convert numbers, dates, etc.
  if (!isAUnitConvertibleFieldType(sourceType)) {
    return timeserie;
  }

  const sourceUnit = timeserie.meta?.units?.[timeserie.field] ?? null;

  if (!destinationUnit || sourceUnit === destinationUnit) {
    return timeserie;
  }

  // Don't bother with invalid conversions
  if (
    (sourceType === 'duration' && !isADurationUnit(destinationUnit)) ||
    (sourceType === 'size' && !isASizeUnit(destinationUnit)) ||
    (sourceType === 'rate' && !isARateUnit(destinationUnit))
  ) {
    Sentry.captureMessage(
      `Attempted invalid timeseries conversion from ${sourceType} in ${sourceUnit} to ${destinationUnit}`
    );

    return timeserie;
  }

  return {
    ...timeserie,
    data: timeserie.data.map(datum => {
      const {value} = datum;

      let scaledValue: number = value;

      if (sourceType === 'duration') {
        scaledValue = convertDuration(
          value,
          (sourceUnit ?? DurationUnit.MILLISECOND) as DurationUnit,
          destinationUnit as DurationUnit
        );
      } else if (sourceType === 'size') {
        scaledValue = convertSize(
          value,
          (sourceUnit ?? SizeUnit.BYTE) as SizeUnit,
          destinationUnit as SizeUnit
        );
      } else if (sourceType === 'rate') {
        scaledValue = convertRate(
          value,
          (sourceUnit ?? RateUnit.PER_SECOND) as RateUnit,
          destinationUnit as RateUnit
        );
      } else {
        Sentry.captureMessage(
          `Attempted invalid timeseries conversion from ${sourceType} in ${sourceUnit} to ${destinationUnit}`
        );
      }

      return {
        ...datum,
        value: scaledValue,
      };
    }),
    meta: {
      ...timeserie.meta,
      fields: {
        [timeserie.field]: sourceType,
      },
      units: {
        [timeserie.field]: destinationUnit,
      },
    },
  };
}
