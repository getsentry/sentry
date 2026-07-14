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
  isValidating: boolean;
  shouldCleanupAggregateColumns: boolean;
  shouldCleanupColumns: boolean;
  validationData: EventValidationData | undefined;
  onFieldsCleanup?: (fields: string[], sortBys: Sort[]) => void;
}

export function useValidatedExploreColumns({
  attributes,
  isValidating,
  shouldCleanupAggregateColumns,
  shouldCleanupColumns,
  validationData,
  onFieldsCleanup,
}: UseValidatedExploreColumnsOptions) {
  const aggregateFields = useQueryParamsAggregateFields();
  const aggregateSortBys = useQueryParamsAggregateSortBys();
  const fields = useQueryParamsFields();
  const sortBys = useQueryParamsSortBys();
  const setQueryParams = useSetQueryParams();
  const lastAggregateCleanupRef = useRef<string | null>(null);
  const lastColumnsCleanupRef = useRef<string | null>(null);
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
    if (!shouldCleanupColumns || isValidating) {
      return;
    }

    const fieldsChanged =
      validatedFields.length !== fields.length ||
      validatedFields.some((field, index) => field !== fields[index]);

    if (fieldsChanged) {
      const nextFields = [...validatedFields];
      const nextSortBys = sortBys.filter(sortBy => nextFields.includes(sortBy.field));
      const cleanupKey = JSON.stringify([fields, nextFields, sortBys, nextSortBys]);

      if (lastColumnsCleanupRef.current !== cleanupKey) {
        lastColumnsCleanupRef.current = cleanupKey;
        setQueryParams({fields: nextFields, sortBys: nextSortBys});
        onFieldsCleanup?.(nextFields, nextSortBys);
      }
    } else {
      lastColumnsCleanupRef.current = null;
    }
  }, [
    fields,
    isValidating,
    onFieldsCleanup,
    setQueryParams,
    shouldCleanupColumns,
    sortBys,
    validatedFields,
  ]);

  useEffect(() => {
    if (!shouldCleanupAggregateColumns || isValidating) {
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
      const nextAggregateFields = validatedAggregateFields.map(serializeAggregateField);
      const nextAggregateSortBys = aggregateSortBys.filter(sortBy =>
        validAggregateFields.has(sortBy.field)
      );
      const cleanupKey = JSON.stringify([
        aggregateFields.map(serializeAggregateField),
        nextAggregateFields,
        aggregateSortBys,
        nextAggregateSortBys,
      ]);

      if (lastAggregateCleanupRef.current !== cleanupKey) {
        lastAggregateCleanupRef.current = cleanupKey;
        setQueryParams({
          aggregateFields: nextAggregateFields,
          aggregateSortBys: nextAggregateSortBys,
        });
      }
    } else {
      lastAggregateCleanupRef.current = null;
    }
  }, [
    aggregateFields,
    aggregateSortBys,
    isValidating,
    setQueryParams,
    shouldCleanupAggregateColumns,
    validatedAggregateFields,
  ]);

  return validatedColumnData;
}
