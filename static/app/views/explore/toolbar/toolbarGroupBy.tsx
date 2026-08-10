import {useCallback, useMemo, useState} from 'react';

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
import {DragNDropContext} from 'sentry/views/explore/contexts/dragNDropContext';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import type {Column} from 'sentry/views/explore/hooks/useDragNDropColumns';
import {useGroupByFields} from 'sentry/views/explore/hooks/useGroupByFields';
import {useSpanItemAttributes} from 'sentry/views/explore/hooks/useTraceItemAttributes';
import {useValidatedGroupBys} from 'sentry/views/explore/hooks/useValidatedGroupBys';
import {useValidateSpansTab} from 'sentry/views/explore/spans/hooks/useValidateSpansTab';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {
  mergeValidatedGroupByTags,
  shouldHideGroupByForValidation,
} from 'sentry/views/explore/utils/groupByValidation';
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
  const validationIsPending =
    validationFetching || validationLoading || validationIsPlaceholderData;

  const cleanupInvalidGroupBys = useCallback(
    (validatedGroupBys: string[]) => {
      if (validatedGroupBys.some(Boolean)) {
        setGroupBys(validatedGroupBys);
      } else {
        setGroupBys(validatedGroupBys, Mode.SAMPLES);
      }
    },
    [setGroupBys]
  );
  const {visibleGroupBys} = useValidatedGroupBys({
    groupBys,
    validationData: validatedSearchQueryData,
    validationIsPending,
    onGroupBysCleanup: cleanupInvalidGroupBys,
  });

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

    return mergeValidatedGroupByTags({
      booleanTags,
      numberTags,
      stringTags,
      validatedFields: [validatedField],
    });
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
