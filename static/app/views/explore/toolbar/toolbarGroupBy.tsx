import {useCallback, useMemo} from 'react';
import {useSortable} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import type {SelectKey, SelectOption} from 'sentry/components/core/compactSelect';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {Tooltip} from 'sentry/components/core/tooltip';
import {IconAdd} from 'sentry/icons/iconAdd';
import {IconDelete} from 'sentry/icons/iconDelete';
import {IconGrabbable} from 'sentry/icons/iconGrabbable';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {DragNDropContext} from 'sentry/views/explore/contexts/dragNDropContext';
import {
  useExploreGroupBys,
  useSetExploreGroupBys,
} from 'sentry/views/explore/contexts/pageParamsContext';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {useTraceItemTags} from 'sentry/views/explore/contexts/spanTagsContext';
import type {Column} from 'sentry/views/explore/hooks/useDragNDropColumns';
import {useGroupByFields} from 'sentry/views/explore/hooks/useGroupByFields';

import {
  ToolbarFooter,
  ToolbarFooterButton,
  ToolbarHeader,
  ToolbarLabel,
  ToolbarRow,
  ToolbarSection,
} from './styles';

interface ToolbarGroupBy {
  autoSwitchToAggregates: boolean;
}

export function ToolbarGroupBy({autoSwitchToAggregates}: ToolbarGroupBy) {
  const {tags} = useTraceItemTags();

  const groupBys = useExploreGroupBys();
  const setGroupBys = useSetExploreGroupBys();

  const setColumns = useCallback(
    (columns: string[], op: 'insert' | 'update' | 'delete' | 'reorder') => {
      if (autoSwitchToAggregates && (op === 'insert' || op === 'update')) {
        setGroupBys(columns, Mode.AGGREGATE);
      } else {
        setGroupBys(columns);
      }
    },
    [autoSwitchToAggregates, setGroupBys]
  );

  const options: Array<SelectOption<string>> = useGroupByFields({groupBys, tags});

  return (
    <DragNDropContext columns={groupBys} setColumns={setColumns} defaultColumn={() => ''}>
      {({editableColumns, insertColumn, updateColumnAtIndex, deleteColumnAtIndex}) => {
        return (
          <ToolbarSection data-test-id="section-group-by">
            <ToolbarHeader>
              <Tooltip
                position="right"
                title={t(
                  'Aggregated data by a key attribute to calculate averages, percentiles, count and more'
                )}
              >
                <ToolbarLabel>{t('Group By')}</ToolbarLabel>
              </Tooltip>
            </ToolbarHeader>
            {editableColumns.map((column, i) => (
              <ColumnEditorRow
                key={column.id}
                canDelete={editableColumns.length > 1}
                column={column}
                options={options}
                onColumnChange={c => updateColumnAtIndex(i, c)}
                onColumnDelete={() => deleteColumnAtIndex(i)}
              />
            ))}
            <ToolbarFooter>
              <ToolbarFooterButton
                borderless
                size="zero"
                icon={<IconAdd />}
                onClick={() => insertColumn()}
                priority="link"
                aria-label={t('Add Group')}
              >
                {t('Add Group')}
              </ToolbarFooterButton>
            </ToolbarFooter>
          </ToolbarSection>
        );
      }}
    </DragNDropContext>
  );
}

interface ColumnEditorRowProps {
  canDelete: boolean;
  column: Column<string>;
  onColumnChange: (column: string) => void;
  onColumnDelete: () => void;
  options: Array<SelectOption<string>>;
  disabled?: boolean;
}

function ColumnEditorRow({
  canDelete,
  column,
  options,
  onColumnChange,
  onColumnDelete,
  disabled = false,
}: ColumnEditorRowProps) {
  const {attributes, listeners, setNodeRef, transform, transition} = useSortable({
    id: column.id,
  });

  function handleColumnChange(option: SelectOption<SelectKey>) {
    if (defined(option) && typeof option.value === 'string') {
      onColumnChange(option.value);
    }
  }

  const label = useMemo(() => {
    const tag = options.find(option => option.value === column.column);
    return <TriggerLabel>{tag?.label ?? column.column}</TriggerLabel>;
  }, [column.column, options]);

  return (
    <ToolbarRow
      key={column.id}
      ref={setNodeRef}
      style={{transform: CSS.Transform.toString(transform), transition}}
      {...attributes}
    >
      {canDelete ? (
        <Button
          aria-label={t('Drag to reorder')}
          borderless
          size="zero"
          disabled={disabled}
          icon={<IconGrabbable size="sm" />}
          {...listeners}
        />
      ) : null}
      <StyledCompactSelect
        data-test-id="editor-column"
        options={options}
        triggerLabel={label}
        disabled={disabled}
        value={column.column ?? ''}
        onChange={handleColumnChange}
        searchable
        triggerProps={{style: {width: '100%'}}}
      />
      {canDelete ? (
        <Button
          aria-label={t('Remove Column')}
          borderless
          size="zero"
          icon={<IconDelete size="sm" />}
          onClick={() => onColumnDelete()}
        />
      ) : null}
    </ToolbarRow>
  );
}

const StyledCompactSelect = styled(CompactSelect)`
  flex-grow: 1;
  min-width: 0;
`;

const TriggerLabel = styled('span')`
  ${p => p.theme.overflowEllipsis}
  text-align: left;
  line-height: normal;
  position: relative;
  font-weight: normal;
`;
