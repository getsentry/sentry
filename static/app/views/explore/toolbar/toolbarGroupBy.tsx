import {useEffect, useMemo} from 'react';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import type {SelectKey, SelectOption} from 'sentry/components/compactSelect';
import {CompactSelect} from 'sentry/components/compactSelect';
import {IconAdd} from 'sentry/icons/iconAdd';
import {IconDelete} from 'sentry/icons/iconDelete';
import {IconGrabbable} from 'sentry/icons/iconGrabbable';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {useGroupBys} from 'sentry/views/explore/hooks/useGroupBys';

import {useSpanTags} from '../contexts/spanTagsContext';
import {type Column, useDragNDropColumns} from '../hooks/useDragNDropColumns';
import {useResultMode} from '../hooks/useResultsMode';

import {ToolbarHeader, ToolbarHeaderButton, ToolbarLabel, ToolbarSection} from './styles';

interface ToolbarGroupByProps {
  disabled?: boolean;
}

export function ToolbarGroupBy({disabled}: ToolbarGroupByProps) {
  const tags = useSpanTags();

  const {groupBys, setGroupBys} = useGroupBys();

  const options: SelectOption<string>[] = useMemo(() => {
    // These options aren't known to exist on this project but it was inserted into
    // the group bys somehow so it should be a valid options in the group bys.
    //
    // One place this may come from is when switching projects/environment/date range,
    // a tag may disappear based on the selection.
    const unknownOptions = groupBys
      .filter(groupBy => groupBy && !tags.hasOwnProperty(groupBy))
      .map(groupBy => {
        return {
          label: groupBy,
          value: groupBy,
          textValue: groupBy,
        };
      });

    const knownOptions = Object.keys(tags).map(tagKey => {
      return {
        label: tagKey,
        value: tagKey,
        textValue: tagKey,
      };
    });

    return [
      // hard code in an empty option
      {label: t('None'), value: '', textValue: t('none')},
      ...unknownOptions,
      ...knownOptions,
    ];
  }, [groupBys, tags]);

  const {
    editableColumns,
    insertColumn,
    updateColumnAtIndex,
    deleteColumnAtIndex,
    swapColumnsAtIndex,
  } = useDragNDropColumns({columns: groupBys});

  useEffect(() => {
    setGroupBys(editableColumns.map(({column}) => column ?? ''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editableColumns]);

  return (
    <ToolbarSection data-test-id="section-group-by">
      <StyledToolbarHeader>
        <ToolbarLabel disabled={disabled}>{t('Group By')}</ToolbarLabel>
        <ToolbarHeaderButton
          disabled={disabled}
          size="zero"
          onClick={insertColumn}
          borderless
          aria-label={t('Add Group')}
          icon={<IconAdd />}
        />
      </StyledToolbarHeader>
      <div>
        <ColumnEditor
          columns={editableColumns}
          onColumnChange={updateColumnAtIndex}
          onColumnDelete={deleteColumnAtIndex}
          onColumnSwap={swapColumnsAtIndex}
          options={options}
        />
      </div>
    </ToolbarSection>
  );
}

const StyledToolbarHeader = styled(ToolbarHeader)`
  margin-bottom: ${space(1)};
`;

interface ColumnEditorProps {
  columns: Column[];
  onColumnChange: (i: number, column: string) => void;
  onColumnDelete: (i: number) => void;
  onColumnSwap: (i: number, j: number) => void;
  options: SelectOption<string>[];
}

export function ColumnEditor({
  columns,
  onColumnChange,
  onColumnDelete,
  onColumnSwap,
  options,
}: ColumnEditorProps) {
  const [resultMode] = useResultMode();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event) {
    const {active, over} = event;

    if (active.id !== over.id) {
      const oldIndex = columns.findIndex(({id}) => id === active.id);
      const newIndex = columns.findIndex(({id}) => id === over.id);
      onColumnSwap(oldIndex, newIndex);
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={columns} strategy={verticalListSortingStrategy}>
        {columns.map((column, i) => {
          return (
            <ColumnEditorRow
              disabled={resultMode === 'samples'}
              key={column.id}
              canDelete={columns.length > 1 || !['', undefined].includes(column.column)}
              column={column}
              options={options}
              onColumnChange={c => onColumnChange(i, c)}
              onColumnDelete={() => onColumnDelete(i)}
            />
          );
        })}
      </SortableContext>
    </DndContext>
  );
}

interface ColumnEditorRowProps {
  canDelete: boolean;
  column: Column;
  onColumnChange: (column: string) => void;
  onColumnDelete: () => void;
  options: SelectOption<string>[];
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
    return <TriggerLabel>{tag?.label ?? t('None')}</TriggerLabel>;
  }, [column.column, options]);

  return (
    <RowContainer
      key={column.id}
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      {...attributes}
    >
      <Button
        aria-label={t('Drag to reorder')}
        borderless
        size="zero"
        disabled={disabled}
        icon={<IconGrabbable size="sm" />}
        {...listeners}
      />
      <StyledCompactSelect
        data-test-id="editor-column"
        options={options}
        triggerLabel={label}
        disabled={disabled}
        value={column.column ?? ''}
        onChange={handleColumnChange}
        searchable
        triggerProps={{
          style: {
            width: '100%',
          },
        }}
      />
      <Button
        aria-label={t('Remove Column')}
        borderless
        disabled={!canDelete || disabled}
        size="zero"
        icon={<IconDelete size="sm" />}
        onClick={() => onColumnDelete()}
      />
    </RowContainer>
  );
}

const RowContainer = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${space(0.5)};

  :not(:first-child) {
    margin-top: ${space(1)};
  }
`;

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
