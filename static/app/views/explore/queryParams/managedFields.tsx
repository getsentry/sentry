import {defined} from 'sentry/utils';
import {parseFunction} from 'sentry/utils/discover/fields';
import {isGroupBy, type GroupBy} from 'sentry/views/explore/queryParams/groupBy';
import type {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';
import {
  isBaseVisualize,
  isVisualizeFunction,
  Visualize,
  type BaseVisualize,
} from 'sentry/views/explore/queryParams/visualize';
import type {WritableQueryParams} from 'sentry/views/explore/queryParams/writableQueryParams';

type DerivedUpdatedManagedFields = {
  updatedFields?: string[];
  updatedManagedFields?: Set<string>;
};

export function deriveUpdatedManagedFields(
  managedFields: Set<string>,
  readableQueryParams: ReadableQueryParams,
  writableQueryParams: WritableQueryParams
): DerivedUpdatedManagedFields {
  // null means to clear it, when this happens we should stop managing all fields
  if (writableQueryParams.fields === null) {
    return {
      updatedManagedFields: new Set(),
    };
  }

  const {readableRefs, writableRefs} = findAllFieldRefs(
    readableQueryParams,
    writableQueryParams
  );

  const allFields = new Set<string>([...readableRefs.keys(), ...writableRefs.keys()]);

  // if the writable fields is undefined, it means we're not changing it
  // so we should infer it from the readable fields
  const fields = writableQueryParams.fields ?? readableQueryParams.fields;

  const fieldsToAdd = new Set<string>();
  const fieldsToDelete = new Set<string>();
  const updatedManagedFields = new Set(managedFields);

  allFields.forEach(field => {
    const readableCount = readableRefs.get(field) || 0;
    const writableCount = writableRefs.get(field) || 0;

    if (
      writableCount > readableCount &&
      !updatedManagedFields.has(field) &&
      !fields.includes(field)
    ) {
      // found a field that
      // 1. isn't in the list of fields
      // 2. isn't being managed
      // 3. a writable reference was found
      // this means we should start managing the field
      updatedManagedFields.add(field);
      fieldsToAdd.add(field);
    } else if (
      readableCount > 0 &&
      writableCount <= 0 &&
      updatedManagedFields.has(field)
    ) {
      // found a field that
      // 1. all references have been removed
      // 2. is being managed
      updatedManagedFields.delete(field);
      fieldsToDelete.add(field);
    }
  });

  const {removedFields} = findChangedFields(readableQueryParams, writableQueryParams);

  // when a field is intentionally removed, it should no longer be managed
  removedFields.forEach(field => {
    updatedManagedFields.delete(field);
    fieldsToDelete.delete(field);
  });

  let updatedFields: string[] | undefined = undefined;

  if (fieldsToAdd.size || fieldsToDelete.size) {
    updatedFields = fields.filter(field => {
      const keep = !fieldsToDelete.has(field);
      if (!keep) {
        // it's possible the user manually added a duplicate of the field,
        // but we want to only delete 1 instance of the field
        fieldsToDelete.delete(field);
      }
      return keep;
    });
    updatedFields.push(...fieldsToAdd);
  }

  return {updatedFields, updatedManagedFields};
}

type Counter = Map<string, number>;

/**
 * Finds all references to fields that we should consider managing. This looks after
 * 1. visualized functions
 */
function findAllFieldRefs(
  readableQueryParams: ReadableQueryParams,
  writableQueryParams: WritableQueryParams
): {
  readableRefs: Counter;
  writableRefs: Counter;
} {
  const readableRefs = new Map();
  const writableRefs = new Map();

  // Group By

  const readableGroupBys = readableQueryParams.groupBys.filter(Boolean);

  readableGroupBys.forEach(groupBy => {
    const count = readableRefs.get(groupBy) || 0;
    readableRefs.set(groupBy, count + 1);
  });

  const writableGroupBys =
    writableQueryParams.aggregateFields === null
      ? // null means to clear it so make sure to handle it correctly
        []
      : defined(writableQueryParams.aggregateFields)
        ? writableQueryParams.aggregateFields
            .filter<GroupBy>(isGroupBy)
            .map(groupBy => groupBy.groupBy)
            .filter(Boolean)
        : // undefined means it's unchanged so use the results from the readableQueryParams
          readableGroupBys;

  writableGroupBys.forEach(groupBy => {
    const count = writableRefs.get(groupBy) || 0;
    writableRefs.set(groupBy, count + 1);
  });

  // Visualizes

  const readableVisualizeFields: string[] =
    readableQueryParams.visualizes.flatMap(getVisualizeFields);

  readableVisualizeFields.forEach(field => {
    const count = readableRefs.get(field) || 0;
    readableRefs.set(field, count + 1);
  });

  const writableVisualizeFields: string[] =
    writableQueryParams.aggregateFields === null
      ? // null means to clear it so make sure to handle it correctly
        []
      : defined(writableQueryParams.aggregateFields)
        ? writableQueryParams.aggregateFields
            .filter<BaseVisualize>(isBaseVisualize)
            .flatMap(visualize => {
              const visualizes = Visualize.fromJSON(visualize);
              return visualizes.flatMap(getVisualizeFields);
            })
        : // undefined means it's unchanged so use the results from the readableQueryParams
          readableVisualizeFields;

  writableVisualizeFields.forEach(field => {
    const count = writableRefs.get(field) || 0;
    writableRefs.set(field, count + 1);
  });

  return {readableRefs, writableRefs};
}

function getVisualizeFields(visualize: Visualize): string[] {
  if (isVisualizeFunction(visualize)) {
    const field = parseFunction(visualize.yAxis)?.arguments?.[0];
    return defined(field) ? [field] : [];
  }

  return []; // TODO: unsupported
}

function findChangedFields(
  readableQueryParams: ReadableQueryParams,
  writableQueryParams: WritableQueryParams
): {
  addedFields: Set<string>;
  removedFields: Set<string>;
} {
  const addedFields = new Set<string>();
  const removedFields = new Set<string>();

  // TODO: check if we need to distinguish between null and undefined here
  if (defined(writableQueryParams.fields)) {
    function countFields(counter: Counter, field: string) {
      const count = counter.get(field) || 0;
      counter.set(field, count + 1);
      return counter;
    }

    const readableFields: Counter = readableQueryParams.fields.reduce(
      countFields,
      new Map()
    );

    const writableFields: Counter = writableQueryParams.fields.reduce(
      countFields,
      new Map()
    );

    const fields = new Set([...readableFields.keys(), ...writableFields.keys()]);
    fields.forEach(field => {
      const readableCount = readableFields.get(field) || 0;
      const writableCount = writableFields.get(field) || 0;
      if (readableCount > writableCount) {
        removedFields.add(field);
      } else {
        addedFields.add(field);
      }
    });
  }

  return {
    addedFields,
    removedFields,
  };
}
