import * as Sentry from '@sentry/react';
import partialRight from 'lodash/partialRight';

import {convertDuration} from 'sentry/utils/unitConversion/convertDuration';
import {convertRate} from 'sentry/utils/unitConversion/convertRate';
import {convertSize} from 'sentry/utils/unitConversion/convertSize';
import {
  isADurationUnit,
  isARateUnit,
  isASizeUnit,
  isAUnitConvertibleFieldType,
} from 'sentry/views/dashboards/widgets/common/typePredicates';
import type {
  TabularData,
  TabularValueUnit,
} from 'sentry/views/dashboards/widgets/common/types';
import {
  FALLBACK_TYPE,
  FALLBACK_UNIT_FOR_FIELD_TYPE,
} from 'sentry/views/dashboards/widgets/timeSeriesWidget/settings';

export function scaleTabularDataColumn(
  tabularData: Readonly<TabularData>,
  columnName: string,
  destinationUnit: TabularValueUnit
): TabularData {
  const sourceType = tabularData.meta.fields[columnName] ?? FALLBACK_TYPE;

  // Don't bother trying to convert numbers, dates, etc.
  if (!isAUnitConvertibleFieldType(sourceType)) {
    return tabularData;
  }

  const sourceUnit = tabularData.meta.units[columnName];

  if (!destinationUnit || sourceUnit === destinationUnit) {
    return tabularData;
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

    return tabularData;
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
    ...tabularData,
    data: tabularData.data.map(datum => {
      const value = datum[columnName] ?? null;
      if (typeof value !== 'number') {
        return datum;
      }

      return {
        ...datum,
        [columnName]: value === null ? null : scaler(value),
      };
    }),
    meta: {
      ...tabularData.meta,
      units: {
        ...tabularData.meta.units,
        [columnName]: destinationUnit,
      },
    },
  };
}
