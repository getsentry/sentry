import isEqual from 'lodash/isEqual';

import {
  aggregateOutputType,
  isAggregateField,
  isLegalYAxisType,
} from 'app/utils/discover/fields';
import {Widget} from 'app/views/dashboardsV2/types';

import {DisplayType} from '../utils';

type ValidationError = {
  [key: string]: string[] | ValidationError[] | ValidationError;
};

type FlatValidationError = {
  [key: string]: string | FlatValidationError[] | FlatValidationError;
};

export function mapErrors(
  data: ValidationError,
  update: FlatValidationError
): FlatValidationError {
  Object.keys(data).forEach((key: string) => {
    const value = data[key];
    // Recurse into nested objects.
    if (Array.isArray(value) && typeof value[0] === 'string') {
      update[key] = value[0];
      return;
    } else if (Array.isArray(value) && typeof value[0] === 'object') {
      update[key] = (value as ValidationError[]).map(item => mapErrors(item, {}));
    } else {
      update[key] = mapErrors(value as ValidationError, {});
    }
  });

  return update;
}

export function normalizeQueries(
  displayType: DisplayType,
  queries: Widget['queries']
): Widget['queries'] {
  const isTimeseriesChart = [
    DisplayType.LINE,
    DisplayType.AREA,
    DisplayType.STACKED_AREA,
    DisplayType.BAR,
  ].includes(displayType);

  if (
    [DisplayType.TABLE, DisplayType.WORLD_MAP, DisplayType.BIG_NUMBER].includes(
      displayType
    )
  ) {
    // Some display types may only support at most 1 query.
    queries = queries.slice(0, 1);
  } else if (isTimeseriesChart) {
    // Timeseries charts supports at most 3 queries.
    queries = queries.slice(0, 3);
  }

  if (displayType === DisplayType.TABLE) {
    return queries;
  }

  // Filter out non-aggregate fields
  queries = queries.map(query => {
    let fields = query.fields.filter(isAggregateField);

    if (isTimeseriesChart || displayType === DisplayType.WORLD_MAP) {
      // Filter out fields that will not generate numeric output types
      fields = fields.filter(field => isLegalYAxisType(aggregateOutputType(field)));
    }

    if (isTimeseriesChart && fields.length && fields.length > 3) {
      // Timeseries charts supports at most 3 fields.
      fields = fields.slice(0, 3);
    }

    return {
      ...query,
      fields: fields.length ? fields : ['count()'],
    };
  });

  if (isTimeseriesChart) {
    // For timeseries widget, all queries must share identical set of fields.

    const referenceFields = [...queries[0].fields];

    queryLoop: for (const query of queries) {
      if (referenceFields.length >= 3) {
        break;
      }

      if (isEqual(referenceFields, query.fields)) {
        continue;
      }

      for (const field of query.fields) {
        if (referenceFields.length >= 3) {
          break queryLoop;
        }

        if (!referenceFields.includes(field)) {
          referenceFields.push(field);
        }
      }
    }

    queries = queries.map(query => {
      return {
        ...query,
        fields: referenceFields,
      };
    });
  }

  if ([DisplayType.WORLD_MAP, DisplayType.BIG_NUMBER].includes(displayType)) {
    // For world map chart, cap fields of the queries to only one field.
    queries = queries.map(query => {
      return {
        ...query,
        fields: query.fields.slice(0, 1),
      };
    });
  }

  return queries;
}
