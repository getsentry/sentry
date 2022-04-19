import React, {Fragment, useMemo, useState} from 'react';
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import Field from 'sentry/components/forms/field';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {generateFieldAsString, QueryFieldValue} from 'sentry/utils/discover/fields';
import {FieldValueKind} from 'sentry/views/eventsV2/table/types';
import {generateFieldOptions} from 'sentry/views/eventsV2/utils';

import {QueryField} from './queryField';
import {SortableQueryField} from './sortableQueryField';

const GROUP_BY_LIMIT = 20;
const EMPTY_FIELD: QueryFieldValue = {kind: FieldValueKind.FIELD, field: ''};
interface Props {
  fieldOptions: ReturnType<typeof generateFieldOptions>;
  onChange: (fields: QueryFieldValue[]) => void;
  columns?: QueryFieldValue[];
}

export function GroupBySelector({fieldOptions, columns = [], onChange}: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);

  function handleAdd() {
    const newColumns =
      columns.length === 0
        ? [{...EMPTY_FIELD}, {...EMPTY_FIELD}]
        : [...columns, {...EMPTY_FIELD}];
    onChange(newColumns);
  }

  function handleSelect(value: QueryFieldValue, index?: number) {
    const newColumns = [...columns];
    if (columns.length === 0) {
      newColumns.push(value);
    } else if (defined(index)) {
      newColumns[index] = value;
    }
    onChange(newColumns);
  }

  function handleRemove(index: number) {
    const newColumns = [...columns];
    newColumns.splice(index, 1);
    onChange(newColumns);
  }

  const hasOnlySingleColumnWithValue =
    columns.length === 1 &&
    columns[0].kind === FieldValueKind.FIELD &&
    columns[0]?.field !== '';

  const canDrag = columns.length > 1;
  const canDelete = canDrag || hasOnlySingleColumnWithValue;

  const filteredFieldOptions = useMemo(() => {
    const columnFieldsAsString = columns.map(generateFieldAsString);
    return Object.keys(fieldOptions).reduce((acc, key) => {
      const value = fieldOptions[key];
      if (!columnFieldsAsString.includes(value.value.meta.name)) {
        acc[key] = value;
      }
      return acc;
    }, {});
  }, [fieldOptions, columns]);

  const items = useMemo(() => {
    return columns.reduce((acc, _column, index) => {
      acc.push(String(index));
      return acc;
    }, [] as string[]);
  }, [columns]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  return (
    <Fragment>
      <StyledField inline={false} flexibleControlStateSize stacked>
        {columns.length === 0 ? (
          <QueryFieldWrapper>
            <QueryField
              value={EMPTY_FIELD}
              fieldOptions={filteredFieldOptions}
              onChange={value => handleSelect(value, 0)}
              canDelete={canDelete}
            />
          </QueryFieldWrapper>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={({active}) => {
              setActiveId(active.id);
            }}
            onDragEnd={({over, active}) => {
              setActiveId(null);

              if (over) {
                const activeDragId = active.id;
                const getIndex = items.indexOf.bind(items);
                const activeIndex = activeDragId ? getIndex(activeDragId) : -1;
                const overIndex = getIndex(over.id);

                if (activeIndex !== overIndex) {
                  onChange(arrayMove(columns, activeIndex, overIndex));
                }
              }
            }}
            onDragCancel={() => {
              setActiveId(null);
            }}
          >
            <SortableContext items={items} strategy={verticalListSortingStrategy}>
              {columns.map((column, index) => {
                const key = items[index];
                const dragId = key;
                return (
                  <SortableQueryField
                    key={key}
                    dragId={dragId}
                    value={column}
                    fieldOptions={filteredFieldOptions}
                    onChange={value => handleSelect(value, index)}
                    onDelete={() => handleRemove(index)}
                    canDrag={canDrag}
                    canDelete={canDelete}
                  />
                );
              })}
            </SortableContext>
            <DragOverlay dropAnimation={null}>
              {activeId ? (
                <Ghost>
                  <QueryField
                    value={columns[Number(activeId)]}
                    fieldOptions={filteredFieldOptions}
                    onChange={value => handleSelect(value, Number(activeId))}
                    onDelete={() => handleRemove(Number(activeId))}
                    canDrag={canDrag}
                    canDelete={canDelete}
                  />
                </Ghost>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </StyledField>
      {columns.length < GROUP_BY_LIMIT && (
        <AddGroupButton size="small" icon={<IconAdd isCircled />} onClick={handleAdd}>
          {t('Add Group')}
        </AddGroupButton>
      )}
    </Fragment>
  );
}

const QueryFieldWrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;

  :not(:last-child) {
    margin-bottom: ${space(1)};
  }

  > * + * {
    margin-left: ${space(1)};
  }
`;

const StyledField = styled(Field)`
  padding-bottom: ${space(1)};
`;

const AddGroupButton = styled(Button)`
  width: min-content;
`;

const Ghost = styled('div')`
  position: absolute;
  background: ${p => p.theme.background};
  padding: ${space(0.5)};
  border-radius: ${p => p.theme.borderRadius};
  box-shadow: 0 0 15px rgba(0, 0, 0, 0.15);
  width: 710px;
  opacity: 0.8;
  cursor: grabbing;
  padding-right: ${space(2)};

  button {
    cursor: grabbing;
  }
`;
