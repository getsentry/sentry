import {useCallback, useState} from 'react';

import type {SelectOption} from 'sentry/components/core/compactSelect';
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
import {TraceItemAttributeProvider} from 'sentry/views/explore/contexts/traceItemAttributeContext';
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
      // automatically switch to aggregates mode when a group by is inserted/updated
      if (op === 'insert' || op === 'update') {
        setGroupBys(columns, Mode.AGGREGATE);
      } else {
        setGroupBys(columns);
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
  const [search, setSearch] = useState<string>('');
  const debouncedSearch = useDebouncedValue(search, 200);

  return (
    <TraceItemAttributeProvider
      enabled
      traceItemType={TraceItemDataset.SPANS}
      search={debouncedSearch}
    >
      <ToolbarGroupByItemContent
        canDelete={canDelete}
        column={column}
        onColumnChange={onColumnChange}
        onColumnDelete={onColumnDelete}
        groupBys={groupBys}
        onSearch={setSearch}
        onClose={() => setSearch('')}
      />
    </TraceItemAttributeProvider>
  );
}

interface ToolbarGroupByItemContentProps extends ToolbarGroupByItemProps {
  onClose: () => void;
  onSearch: (search: string) => void;
}

function ToolbarGroupByItemContent({
  groupBys,
  canDelete,
  column,
  onColumnChange,
  onColumnDelete,
  onSearch,
  onClose,
}: ToolbarGroupByItemContentProps) {
  const {tags: numberTags, isLoading: numberTagsLoading} = useTraceItemTags('number');
  const {tags: stringTags, isLoading: stringTagsLoading} = useTraceItemTags('string');

  const options: Array<SelectOption<string>> = useGroupByFields({
    groupBys,
    numberTags,
    stringTags,
    traceItemType: TraceItemDataset.SPANS,
  });

  const loading = numberTagsLoading || stringTagsLoading;

  return (
    <ToolbarGroupByDropdown
      column={column}
      options={options}
      loading={loading}
      onClose={onClose}
      onSearch={onSearch}
      canDelete={canDelete}
      onColumnChange={onColumnChange}
      onColumnDelete={onColumnDelete}
    />
  );
}
