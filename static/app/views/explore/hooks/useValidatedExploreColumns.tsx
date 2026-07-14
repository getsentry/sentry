import {useEffect, useMemo, useRef} from 'react';

import type {Sort} from 'sentry/utils/discover/fields';
import {serializeAggregateField} from 'sentry/views/explore/queryParams/aggregateField';
import {
  useQueryParamsAggregateFields,
  useQueryParamsAggregateSortBys,
  useQueryParamsFields,
  useQueryParamsSortBys,
  useSetQueryParams,
} from 'sentry/views/explore/queryParams/context';
import {isGroupBy} from 'sentry/views/explore/queryParams/groupBy';
import type {AttributeCollections} from 'sentry/views/explore/utils/columnValidation';
import {getValidatedColumnData} from 'sentry/views/explore/utils/columnValidation';
import type {EventValidationData} from 'sentry/views/explore/utils/validateEventParamsOptions';

interface UseValidatedExploreColumnsOptions {
  attributes: AttributeCollections;
  cleanupAggregateFields: boolean;
  cleanupFields: boolean;
  isValidating: boolean;
  validationData: EventValidationData | undefined;
  onFieldsCleanup?: (fields: string[], sortBys: Sort[]) => void;
}

export function useValidatedExploreColumns({
  attributes,
  cleanupAggregateFields,
  cleanupFields,
  isValidating,
  validationData,
  onFieldsCleanup,
}: UseValidatedExploreColumnsOptions) {
  const aggregateFields = useQueryParamsAggregateFields();
  const aggregateSortBys = useQueryParamsAggregateSortBys();
  const fields = useQueryParamsFields();
  const sortBys = useQueryParamsSortBys();
  const setQueryParams = useSetQueryParams();
  const lastFieldsCleanupRef = useRef<string | null>(null);
  const {
    boolean: booleanAttributes,
    number: numberAttributes,
    string: stringAttributes,
  } = attributes;

  const validatedColumnData = useMemo(
    () =>
      getValidatedColumnData({
        aggregateFields,
        attributes: {
          boolean: booleanAttributes,
          number: numberAttributes,
          string: stringAttributes,
        },
        fields,
        validationData,
      }),
    [
      aggregateFields,
      booleanAttributes,
      fields,
      numberAttributes,
      stringAttributes,
      validationData,
    ]
  );
  const {aggregateFields: validatedAggregateFields, fields: validatedFields} =
    validatedColumnData;

  useEffect(() => {
    if (!cleanupFields || isValidating) {
      return;
    }

    const fieldsChanged =
      validatedFields.length !== fields.length ||
      validatedFields.some((field, index) => field !== fields[index]);

    if (fieldsChanged) {
      const nextFields = [...validatedFields];
      const nextSortBys = sortBys.filter(sortBy => nextFields.includes(sortBy.field));
      const cleanupKey = JSON.stringify([fields, nextFields, sortBys, nextSortBys]);

      if (lastFieldsCleanupRef.current !== cleanupKey) {
        lastFieldsCleanupRef.current = cleanupKey;
        setQueryParams({fields: nextFields, sortBys: nextSortBys});
        onFieldsCleanup?.(nextFields, nextSortBys);
      }
    } else {
      lastFieldsCleanupRef.current = null;
    }
  }, [
    cleanupFields,
    fields,
    isValidating,
    onFieldsCleanup,
    setQueryParams,
    sortBys,
    validatedFields,
  ]);

  useEffect(() => {
    if (!cleanupAggregateFields || isValidating) {
      return;
    }

    const aggregateFieldsChanged =
      validatedAggregateFields.length !== aggregateFields.length ||
      validatedAggregateFields.some((aggregateField, index) => {
        const currentAggregateField = aggregateFields[index];
        if (!currentAggregateField) {
          return true;
        }
        if (isGroupBy(aggregateField) && isGroupBy(currentAggregateField)) {
          return aggregateField.groupBy !== currentAggregateField.groupBy;
        }
        if (!isGroupBy(aggregateField) && !isGroupBy(currentAggregateField)) {
          return aggregateField.yAxis !== currentAggregateField.yAxis;
        }
        return true;
      });

    if (aggregateFieldsChanged) {
      const validAggregateFields = new Set(
        validatedAggregateFields.map(aggregateField =>
          isGroupBy(aggregateField) ? aggregateField.groupBy : aggregateField.yAxis
        )
      );
      setQueryParams({
        aggregateFields: validatedAggregateFields.map(serializeAggregateField),
        aggregateSortBys: aggregateSortBys.filter(sortBy =>
          validAggregateFields.has(sortBy.field)
        ),
      });
    }
  }, [
    aggregateFields,
    aggregateSortBys,
    cleanupAggregateFields,
    isValidating,
    setQueryParams,
    validatedAggregateFields,
  ]);

  return validatedColumnData;
}
