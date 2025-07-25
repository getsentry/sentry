import {useMemo} from 'react';
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
import {
  ToolbarFooter,
  ToolbarFooterButton,
  ToolbarHeader,
  ToolbarLabel,
  ToolbarRow,
  ToolbarSection,
} from 'sentry/views/explore/components/toolbar/styles';
import {DragNDropContext} from 'sentry/views/explore/contexts/dragNDropContext';
import type {Column} from 'sentry/views/explore/hooks/useDragNDropColumns';

interface ToolbarGroupByProps {
  allowMultiple: boolean;
  groupBys: string[];
  options: Array<SelectOption<string>>;
  setGroupBys: (
    groupBys: string[],
    op: 'insert' | 'update' | 'delete' | 'reorder'
  ) => void;
}

export function ToolbarGroupBy({
  allowMultiple,
  groupBys,
  options,
  setGroupBys,
}: ToolbarGroupByProps) {
  const hasFooter = allowMultiple;

  return (
    <DragNDropContext columns={groupBys} setColumns={setGroupBys}>
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
              <GroupBySelector
                key={column.id}
                canDelete={editableColumns.length > 1}
                column={column}
                onColumnChange={c => updateColumnAtIndex(i, c)}
                onColumnDelete={() => deleteColumnAtIndex(i)}
                options={options}
              />
            ))}
            {hasFooter && (
              <ToolbarFooter>
                {allowMultiple && (
                  <ToolbarFooterButton
                    borderless
                    size="zero"
                    icon={<IconAdd />}
                    onClick={() => insertColumn('')}
                    priority="link"
                    aria-label={t('Add Group')}
                  >
                    {t('Add Group')}
                  </ToolbarFooterButton>
                )}
              </ToolbarFooter>
            )}
          </ToolbarSection>
        );
      }}
    </DragNDropContext>
  );
}

interface GroupBySelectorProps {
  canDelete: boolean;
  column: Column<string>;
  onColumnChange: (column: string) => void;
  onColumnDelete: () => void;
  options: Array<SelectOption<string>>;
}

function GroupBySelector({
  canDelete,
  column,
  onColumnChange,
  onColumnDelete,
  options,
}: GroupBySelectorProps) {
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
          icon={<IconGrabbable size="sm" />}
          {...listeners}
        />
      ) : null}
      <StyledCompactSelect
        data-test-id="editor-column"
        options={options}
        triggerLabel={label}
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
