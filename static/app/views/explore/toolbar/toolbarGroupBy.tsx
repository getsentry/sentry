import {useCallback, useState} from 'react';

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
import {useTraceItemTags} from 'sentry/views/explore/contexts/spanTagsContext';
import type {Column} from 'sentry/views/explore/hooks/useDragNDropColumns';
import {useGroupByFields} from 'sentry/views/explore/hooks/useGroupByFields';
import {TraceItemDataset} from 'sentry/views/explore/types';

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

  const spansConfig = {
    traceItemType: TraceItemDataset.SPANS,
    enabled: true,
    search: debouncedSearch,
  };

  const {tags: numberTags, isLoading: numberTagsLoading} = useTraceItemTags(
    spansConfig,
    'number'
  );
  const {tags: stringTags, isLoading: stringTagsLoading} = useTraceItemTags(
    spansConfig,
    'string'
  );
  const {tags: booleanTags, isLoading: booleanTagsLoading} = useTraceItemTags(
    spansConfig,
    'boolean'
  );

  const options = useGroupByFields({
    groupBys,
    numberTags,
    stringTags,
    booleanTags,
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
