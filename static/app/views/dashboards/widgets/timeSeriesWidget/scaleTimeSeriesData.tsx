import * as Sentry from '@sentry/react';
import partialRight from 'lodash/partialRight';

import type {
  AggregationOutputType,
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
import type {TimeSeries} from '../common/types';

import {FALLBACK_TYPE, FALLBACK_UNIT_FOR_FIELD_TYPE} from './settings';

export function scaleTimeSeriesData(
  timeSeries: Readonly<TimeSeries>,
  destinationUnit: DurationUnit | SizeUnit | RateUnit | null
): TimeSeries {
  // TODO: Instead of a fallback, allow this to be `null`, which might happen
  const sourceType =
    (timeSeries.meta?.fields[timeSeries.field] as AggregationOutputType) ??
    (FALLBACK_TYPE as AggregationOutputType);

  // Don't bother trying to convert numbers, dates, etc.
  if (!isAUnitConvertibleFieldType(sourceType)) {
    return timeSeries;
  }

  const sourceUnit = timeSeries.meta?.units?.[timeSeries.field] ?? null;

  if (!destinationUnit || sourceUnit === destinationUnit) {
    return timeSeries;
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

    return timeSeries;
  }

  let scaler: (value: number) => number;
  if (sourceType === 'duration') {
    scaler = partialRight(
      convertDuration,
      sourceUnit ?? FALLBACK_UNIT_FOR_FIELD_TYPE.duration,
      destinationUnit
    );
  } else if (sourceType === 'size') {
    scaler = partialRight(
      convertSize,
      sourceUnit ?? FALLBACK_UNIT_FOR_FIELD_TYPE.size,
      destinationUnit
    );
  } else if (sourceType === 'rate') {
    scaler = partialRight(
      convertRate,
      sourceUnit ?? FALLBACK_UNIT_FOR_FIELD_TYPE.rate,
      destinationUnit
    );
  }

  return {
    ...timeSeries,
    data: timeSeries.data.map(datum => {
      const {value} = datum;
      return {
        ...datum,
        value: scaler(value),
      };
    }),
    meta: {
      ...timeSeries.meta,
      fields: {
        [timeSeries.field]: sourceType,
      },
      units: {
        [timeSeries.field]: destinationUnit,
      },
    },
  };
}
