import {Fragment, useMemo} from 'react';
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

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Button, LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import type {SelectKey, SelectOption} from 'sentry/components/compactSelect';
import {CompactSelect} from 'sentry/components/compactSelect';
import {SPAN_PROPS_DOCS_URL} from 'sentry/constants';
import {IconAdd} from 'sentry/icons/iconAdd';
import {IconDelete} from 'sentry/icons/iconDelete';
import {IconGrabbable} from 'sentry/icons/iconGrabbable';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {TagCollection} from 'sentry/types/group';
import {defined} from 'sentry/utils';
import {TypeBadge} from 'sentry/views/explore/components/typeBadge';

import {type Column, useDragNDropColumns} from '../hooks/useDragNDropColumns';

interface ColumnEditorModalProps extends ModalRenderProps {
  columns: string[];
  numberTags: TagCollection;
  onColumnsChange: (fields: string[]) => void;
  stringTags: TagCollection;
}

export function ColumnEditorModal({
  Header,
  Body,
  Footer,
  closeModal,
  columns,
  onColumnsChange,
  numberTags,
  stringTags,
}: ColumnEditorModalProps) {
  const {
    editableColumns,
    insertColumn,
    updateColumnAtIndex,
    deleteColumnAtIndex,
    swapColumnsAtIndex,
  } = useDragNDropColumns({columns});

  const tags: SelectOption<string>[] = useMemo(() => {
    const allTags = [
      ...Object.values(stringTags).map(tag => {
        return {
          label: tag.name,
          value: tag.key,
          textValue: tag.name,
          trailingItems: <TypeBadge tag={tag} />,
        };
      }),
      ...Object.values(numberTags).map(tag => {
        return {
          label: tag.name,
          value: tag.key,
          textValue: tag.name,
          trailingItems: <TypeBadge tag={tag} />,
        };
      }),
    ];
    allTags.sort((a, b) => {
      if (a.label < b.label) {
        return -1;
      }

      if (a.label > b.label) {
        return 1;
      }

      return 0;
    });
    return allTags;
  }, [stringTags, numberTags]);

  function handleApply() {
    onColumnsChange(editableColumns.map(({column}) => column).filter(defined));
    closeModal();
  }

  return (
    <Fragment>
      <Header closeButton data-test-id="editor-header">
        <h4>{t('Edit Columns')}</h4>
      </Header>
      <Body data-test-id="editor-body">
        <ColumnEditor
          columns={editableColumns}
          onColumnChange={updateColumnAtIndex}
          onColumnDelete={deleteColumnAtIndex}
          onColumnSwap={swapColumnsAtIndex}
          tags={tags}
        />
        <RowContainer>
          <ButtonBar gap={1}>
            <Button
              size="sm"
              aria-label={t('Add a Column')}
              onClick={insertColumn}
              icon={<IconAdd isCircled />}
            >
              {t('Add a Column')}
            </Button>
          </ButtonBar>
        </RowContainer>
      </Body>
      <Footer data-test-id="editor-footer">
        <ButtonBar gap={1}>
          <LinkButton priority="default" href={SPAN_PROPS_DOCS_URL} external>
            {t('Read the Docs')}
          </LinkButton>
          <Button aria-label={t('Apply')} priority="primary" onClick={handleApply}>
            {t('Apply')}
          </Button>
        </ButtonBar>
      </Footer>
    </Fragment>
  );
}

interface ColumnEditorProps {
  columns: Column[];
  onColumnChange: (i: number, column: string) => void;
  onColumnDelete: (i: number) => void;
  onColumnSwap: (i: number, j: number) => void;
  tags: SelectOption<string>[];
}

function ColumnEditor({
  columns,
  onColumnChange,
  onColumnDelete,
  onColumnSwap,
  tags,
}: ColumnEditorProps) {
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
              key={column.id}
              canDelete={columns.length > 1}
              column={column}
              options={tags}
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
}

function ColumnEditorRow({
  canDelete,
  column,
  options,
  onColumnChange,
  onColumnDelete,
}: ColumnEditorRowProps) {
  const {attributes, listeners, setNodeRef, transform, transition} = useSortable({
    id: column.id,
  });

  function handleColumnChange(option: SelectOption<SelectKey>) {
    if (defined(option) && typeof option.value === 'string') {
      onColumnChange(option.value);
    }
  }

  // The compact select component uses the option label to render the current
  // selection. This overrides it to render in a trailing item showing the type.
  const label = useMemo(() => {
    if (defined(column.column)) {
      const tag = options.find(option => option.value === column.column);
      if (defined(tag)) {
        return (
          <TriggerLabel>
            {tag.label}
            {tag.trailingItems &&
              (typeof tag.trailingItems === 'function'
                ? tag.trailingItems({
                    disabled: false,
                    isFocused: false,
                    isSelected: false,
                  })
                : tag.trailingItems)}
          </TriggerLabel>
        );
      }
    }
    return <TriggerLabel>{column.column ?? t('None')}</TriggerLabel>;
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
        size="sm"
        icon={<IconGrabbable size="sm" />}
        {...listeners}
      />
      <StyledCompactSelect
        data-test-id="editor-column"
        options={options}
        triggerLabel={label}
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
        disabled={!canDelete}
        size="sm"
        icon={<IconDelete size="sm" />}
        onClick={() => onColumnDelete()}
      />
    </RowContainer>
  );
}

const RowContainer = styled('div')`
  display: flex;
  flex-direction: row;

  :not(:first-child) {
    margin-top: ${space(1)};
  }
`;

const StyledCompactSelect = styled(CompactSelect)`
  flex-grow: 1;
`;

const TriggerLabel = styled('span')`
  ${p => p.theme.overflowEllipsis}
  text-align: left;
  line-height: normal;
  display: flex;
  justify-content: space-between;
`;
