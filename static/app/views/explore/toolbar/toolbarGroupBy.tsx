import {useCallback, useMemo, useState} from 'react';

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
              groupBys={groupBys}
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
}

function ToolbarGroupByItem({
  groupBys,
  canDelete,
  column,
  onColumnChange,
  onColumnDelete,
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
  const {data: validatedSearchQueryData} = useValidateSpansTab();

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

  const loading = numberTagsLoading || stringTagsLoading || booleanTagsLoading;

  return (
    <ToolbarGroupByDropdown
      column={column}
      options={options}
      loading={loading}
      onClose={() => setSearch(undefined)}
      onSearch={setSearch}
      canDelete={canDelete}
      onColumnChange={onColumnChange}
      onColumnDelete={onColumnDelete}
    />
  );
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
