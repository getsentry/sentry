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
  const lastCleanupRef = useRef<string | null>(null);
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
    if (isValidating) {
      return;
    }

    const fieldsChanged =
      shouldCleanupColumns &&
      (validatedFields.length !== fields.length ||
        validatedFields.some((field, index) => field !== fields[index]));
    const aggregateFieldsChanged =
      shouldCleanupAggregateColumns &&
      (validatedAggregateFields.length !== aggregateFields.length ||
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
        }));

    if (!fieldsChanged && !aggregateFieldsChanged) {
      lastCleanupRef.current = null;
      return;
    }

    const nextFields = fieldsChanged ? [...validatedFields] : undefined;
    const nextSortBys = nextFields
      ? sortBys.filter(sortBy => nextFields.includes(sortBy.field))
      : undefined;
    const validAggregateFields = new Set(
      validatedAggregateFields.map(aggregateField =>
        isGroupBy(aggregateField) ? aggregateField.groupBy : aggregateField.yAxis
      )
    );
    const nextAggregateFields = aggregateFieldsChanged
      ? validatedAggregateFields.map(serializeAggregateField)
      : undefined;
    const nextAggregateSortBys = aggregateFieldsChanged
      ? aggregateSortBys.filter(sortBy => validAggregateFields.has(sortBy.field))
      : undefined;
    const cleanupKey = JSON.stringify([
      fields,
      nextFields,
      sortBys,
      nextSortBys,
      aggregateFields.map(serializeAggregateField),
      nextAggregateFields,
      aggregateSortBys,
      nextAggregateSortBys,
    ]);

    if (lastCleanupRef.current === cleanupKey) {
      return;
    }

    lastCleanupRef.current = cleanupKey;
    setQueryParams({
      fields: nextFields,
      sortBys: nextSortBys,
      aggregateFields: nextAggregateFields,
      aggregateSortBys: nextAggregateSortBys,
    });
    if (nextFields && nextSortBys) {
      onFieldsCleanup?.(nextFields, nextSortBys);
    }
  }, [
    aggregateFields,
    aggregateSortBys,
    fields,
    isValidating,
    onFieldsCleanup,
    setQueryParams,
    shouldCleanupAggregateColumns,
    shouldCleanupColumns,
    sortBys,
    validatedAggregateFields,
    validatedFields,
  ]);

  return validatedColumnData;
}
