import {useCallback} from 'react';

import type {SelectOption} from 'sentry/components/core/compactSelect';
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
import {useGroupByFields} from 'sentry/views/explore/hooks/useGroupByFields';
import {TraceItemDataset} from 'sentry/views/explore/types';

interface ToolbarGroupByProps {
  groupBys: string[];
  setGroupBys: (groupBys: string[], mode?: Mode) => void;
}

export function ToolbarGroupBy({groupBys, setGroupBys}: ToolbarGroupByProps) {
  const {tags: stringTags} = useTraceItemTags('string');

  const options: Array<SelectOption<string>> = useGroupByFields({
    groupBys,
    tags: stringTags,
    traceItemType: TraceItemDataset.SPANS,
  });

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
    <DragNDropContext columns={groupBys} setColumns={setGroupBysWithOp}>
      {({editableColumns, insertColumn, updateColumnAtIndex, deleteColumnAtIndex}) => (
        <ToolbarSection data-test-id="section-group-by">
          <ToolbarGroupByHeader />
          {editableColumns.map((column, i) => (
            <ToolbarGroupByDropdown
              key={column.id}
              canDelete={editableColumns.length > 1}
              column={column}
              onColumnChange={c => updateColumnAtIndex(i, c)}
              onColumnDelete={() => deleteColumnAtIndex(i)}
              options={options}
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
