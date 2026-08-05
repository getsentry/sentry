import {useCallback, useLayoutEffect, useMemo, useRef, useState} from 'react';
import isEqual from 'lodash/isEqual';

import type {TagCollection} from 'sentry/types/group';
import {FieldKind} from 'sentry/utils/fields';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import {
  ToolbarFooter,
  ToolbarSection,
} from 'sentry/views/explore/components/toolbar/styles';
import {
  ToolbarGroupByAddGroupBy,
  ToolbarGroupByDropdown,
  ToolbarGroupByHeader,
} from 'sentry/views/explore/components/toolbar/toolbarGroupBy';
import {prettifyAttributeName} from 'sentry/views/explore/components/traceItemAttributes/utils';
import {DragNDropContext} from 'sentry/views/explore/contexts/dragNDropContext';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import type {Column} from 'sentry/views/explore/hooks/useDragNDropColumns';
import {useGroupByFields} from 'sentry/views/explore/hooks/useGroupByFields';
import {useSpanItemAttributes} from 'sentry/views/explore/hooks/useTraceItemAttributes';
import {useValidateSpansTab} from 'sentry/views/explore/spans/hooks/useValidateSpansTab';
import {TraceItemDataset} from 'sentry/views/explore/types';
import type {EventValidationData} from 'sentry/views/explore/utils/validateEventParamsOptions';

interface ToolbarGroupByProps {
  groupBys: readonly string[];
  setGroupBys: (groupBys: string[], mode?: Mode) => void;
}

export function ToolbarGroupBy({groupBys, setGroupBys}: ToolbarGroupByProps) {
  const {
    data: validatedSearchQueryData,
    isFetching: validationFetching,
    isLoading: validationLoading,
    isPlaceholderData: validationIsPlaceholderData,
  } = useValidateSpansTab();
  const pendingValidatedGroupBys = useRef<{
    from: readonly string[];
    to: readonly string[];
  } | null>(null);
  const validationGroupBys = useRef<{
    data: EventValidationData;
    groupBys: readonly string[];
  } | null>(null);
  const validationIsPending =
    validationFetching || validationLoading || validationIsPlaceholderData;

  const validatedGroupBys = useMemo(
    () => filterInvalidGroupBys(groupBys, validatedSearchQueryData?.field),
    [groupBys, validatedSearchQueryData?.field]
  );
  const visibleGroupBys = useMemo(
    () =>
      filterVisibleGroupBys(
        groupBys,
        validatedSearchQueryData?.field,
        validationIsPending
      ),
    [groupBys, validatedSearchQueryData?.field, validationIsPending]
  );

  useLayoutEffect(() => {
    if (pendingValidatedGroupBys.current) {
      if (isEqual(groupBys, pendingValidatedGroupBys.current.to)) {
        pendingValidatedGroupBys.current = null;
      } else if (
        isEqual(groupBys, pendingValidatedGroupBys.current.from) &&
        isEqual(validatedGroupBys, pendingValidatedGroupBys.current.to)
      ) {
        return;
      }
    }

    if (validationIsPending || !validatedSearchQueryData) {
      return;
    }

    let validationGroupBySnapshot = validationGroupBys.current;
    if (
      !validationGroupBySnapshot?.data ||
      validationGroupBySnapshot.data !== validatedSearchQueryData
    ) {
      validationGroupBySnapshot = {
        data: validatedSearchQueryData,
        groupBys,
      };
      validationGroupBys.current = validationGroupBySnapshot;
    }

    if (
      !isEqual(groupBys, validationGroupBySnapshot.groupBys) ||
      isEqual(groupBys, validatedGroupBys)
    ) {
      return;
    }

    pendingValidatedGroupBys.current = {
      from: groupBys,
      to: validatedGroupBys,
    };

    if (validatedGroupBys.some(Boolean)) {
      setGroupBys(validatedGroupBys);
    } else {
      setGroupBys(validatedGroupBys, Mode.SAMPLES);
    }
  }, [
    groupBys,
    setGroupBys,
    validatedGroupBys,
    validatedSearchQueryData,
    validationIsPending,
  ]);

  const setGroupBysWithOp = useCallback(
    (columns: string[], op: 'insert' | 'update' | 'delete' | 'reorder') => {
      const hasValidGroupBy = columns.some(Boolean);

      // insert/update keeps aggregate mode while a valid group by exists
      if (op === 'insert' || (op === 'update' && hasValidGroupBy)) {
        setGroupBys(columns, Mode.AGGREGATE);
        return;
      }

      if (hasValidGroupBy) {
        setGroupBys(columns);
      } else {
        // when the last group by is cleared, return to samples table
        setGroupBys(columns, Mode.SAMPLES);
      }
    },
    [setGroupBys]
  );

  return (
    <DragNDropContext columns={groupBys.slice()} setColumns={setGroupBysWithOp}>
      {({editableColumns, insertColumn, updateColumnAtIndex, deleteColumnAtIndex}) => (
        <ToolbarSection data-test-id="section-group-by">
          <ToolbarGroupByHeader />
          {editableColumns.map((column, i) => (
            <ToolbarGroupByItem
              key={column.id}
              canDelete={editableColumns.length > 1}
              column={column}
              onColumnChange={c => updateColumnAtIndex(i, c)}
              onColumnDelete={() => deleteColumnAtIndex(i)}
              groupBys={visibleGroupBys}
              validationIsPending={validationIsPending}
              validatedSearchQueryData={validatedSearchQueryData}
            />
          ))}
          <ToolbarFooter>
            <ToolbarGroupByAddGroupBy add={() => insertColumn('')} disabled={false} />
          </ToolbarFooter>
        </ToolbarSection>
      )}
    </DragNDropContext>
  );
}

interface ToolbarGroupByItemProps {
  canDelete: boolean;
  column: Column<string>;
  groupBys: readonly string[];
  onColumnChange: (column: string) => void;
  onColumnDelete: () => void;
  validationIsPending: boolean;
  validatedSearchQueryData?: EventValidationData;
}

function ToolbarGroupByItem({
  groupBys,
  canDelete,
  column,
  onColumnChange,
  onColumnDelete,
  validationIsPending,
  validatedSearchQueryData,
}: ToolbarGroupByItemProps) {
  const [search, setSearch] = useState<string | undefined>(undefined);
  const debouncedSearch = useDebouncedValue(search, 200);

  const {attributes: numberTags, isLoading: numberTagsLoading} = useSpanItemAttributes(
    {search: debouncedSearch},
    'number'
  );
  const {attributes: stringTags, isLoading: stringTagsLoading} = useSpanItemAttributes(
    {search: debouncedSearch},
    'string'
  );
  const {attributes: booleanTags, isLoading: booleanTagsLoading} = useSpanItemAttributes(
    {search: debouncedSearch},
    'boolean'
  );

  const {validatedBooleanTags, validatedNumberTags, validatedStringTags} = useMemo(() => {
    const validatedField = validatedSearchQueryData?.field.find(
      field => field.valid && field.name === column.column
    );

    if (!validatedField) {
      return {
        validatedBooleanTags: booleanTags,
        validatedNumberTags: numberTags,
        validatedStringTags: stringTags,
      };
    }

    return mergeValidatedTags({booleanTags, numberTags, stringTags, validatedField});
  }, [booleanTags, column, numberTags, stringTags, validatedSearchQueryData?.field]);

  const options = useGroupByFields({
    groupBys,
    numberTags: validatedNumberTags,
    stringTags: validatedStringTags,
    booleanTags: validatedBooleanTags,
    traceItemType: TraceItemDataset.SPANS,
  });

  const loading =
    validationIsPending || numberTagsLoading || stringTagsLoading || booleanTagsLoading;
  const displayColumn = shouldHideGroupByForValidation(
    column.column,
    validatedSearchQueryData?.field,
    validationIsPending
  )
    ? {...column, column: ''}
    : column;

  return (
    <ToolbarGroupByDropdown
      column={displayColumn}
      options={options}
      groupBys={groupBys}
      loading={loading}
      onClose={() => setSearch(undefined)}
      onSearch={setSearch}
      canDelete={canDelete}
      onColumnChange={onColumnChange}
      onColumnDelete={onColumnDelete}
    />
  );
}

function filterInvalidGroupBys(
  groupBys: readonly string[],
  fields: EventValidationData['field'] | undefined
): string[] {
  const invalidFields = new Set(
    fields?.filter(field => !field.valid).map(field => field.name)
  );

  if (invalidFields.size === 0) {
    return [...groupBys];
  }

  return groupBys.filter(groupBy => groupBy === '' || !invalidFields.has(groupBy));
}

function filterVisibleGroupBys(
  groupBys: readonly string[],
  fields: EventValidationData['field'] | undefined,
  validationIsPending: boolean
): string[] {
  return groupBys.filter(
    groupBy => !shouldHideGroupByForValidation(groupBy, fields, validationIsPending)
  );
}

function shouldHideGroupByForValidation(
  groupBy: string,
  fields: EventValidationData['field'] | undefined,
  validationIsPending: boolean
): boolean {
  if (groupBy === '') {
    return false;
  }

  const field = fields?.find(({name}) => name === groupBy);

  if (field?.valid) {
    return false;
  }

  return validationIsPending || field?.valid === false;
}

function mergeValidatedTags({
  booleanTags,
  numberTags,
  stringTags,
  validatedField,
}: {
  booleanTags: TagCollection;
  numberTags: TagCollection;
  stringTags: TagCollection;
  validatedField: EventValidationData['field'][number];
}) {
  switch (validatedField.attrType) {
    case 'boolean': {
      const validatedBooleanTags = {
        ...booleanTags,
        [validatedField.name]: {
          key: validatedField.name,
          name: prettifyAttributeName(validatedField.name),
          kind: FieldKind.BOOLEAN,
        },
      };

      return {
        validatedBooleanTags,
        validatedNumberTags: numberTags,
        validatedStringTags: stringTags,
      };
    }
    case 'number': {
      const validatedNumberTags = {
        ...numberTags,
        [validatedField.name]: {
          key: validatedField.name,
          name: prettifyAttributeName(validatedField.name),
          kind: FieldKind.MEASUREMENT,
        },
      };

      return {
        validatedBooleanTags: booleanTags,
        validatedNumberTags,
        validatedStringTags: stringTags,
      };
    }
    case 'string': {
      const validatedStringTags = {
        ...stringTags,
        [validatedField.name]: {
          key: validatedField.name,
          name: prettifyAttributeName(validatedField.name),
          kind: FieldKind.TAG,
        },
      };

      return {
        validatedBooleanTags: booleanTags,
        validatedNumberTags: numberTags,
        validatedStringTags,
      };
    }
    default:
      return {
        validatedBooleanTags: booleanTags,
        validatedNumberTags: numberTags,
        validatedStringTags: stringTags,
      };
  }
}
