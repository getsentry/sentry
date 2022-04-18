import React, {Fragment, useMemo, useState} from 'react';
import {createPortal} from 'react-dom';
import {closestCenter, DndContext, DragOverlay} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy, // <== doesn't break if this is rectSortingStrategy
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
  const [activeGroupBy, setActiveGroupBy] = useState<string | undefined>();

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

  function getStyle({
    isDragging,
    isSorting,
    index,
  }: {
    index?: number;
    isDragging?: boolean;
    isSorting?: boolean;
  } = {}): React.CSSProperties {
    if (isDragging) {
      return {
        cursor: 'grabbing',
      };
    }

    if (isSorting) {
      return {};
    }

    if (index === undefined) {
      return {};
    }

    return {
      transform: 'none',
      transformOrigin: '0',
      '--box-shadow': 'none',
      '--box-shadow-picked-up': 'none',
      overflow: 'visible',
      zIndex: columns.length - index,
      cursor: 'default',
      position: 'relative',
    } as React.CSSProperties;
  }

  const hasOnlySingleColumnWithValue =
    columns.length === 1 &&
    columns[0].kind === FieldValueKind.FIELD &&
    columns[0]?.field !== '';

  const actions = columns.length > 1 || hasOnlySingleColumnWithValue;
  const columnFieldsAsString = columns.map(generateFieldAsString);

  const filteredFieldOptions = useMemo(() => {
    return Object.keys(fieldOptions).reduce((acc, key) => {
      const value = fieldOptions[key];
      if (!columnFieldsAsString.includes(value.value.meta.name)) {
        acc[key] = value;
      }
      return acc;
    }, {});
  }, [fieldOptions, columns]);

  return (
    <Fragment>
      <StyledField inline={false} flexibleControlStateSize stacked>
        {columns.length === 0 ? (
          <QueryFieldWrapper>
            <QueryField
              value={EMPTY_FIELD}
              fieldOptions={filteredFieldOptions}
              onChange={value => handleSelect(value, 0)}
              actions={false}
            />
          </QueryFieldWrapper>
        ) : (
          <DndContext
            collisionDetection={closestCenter}
            onDragStart={({active}) => {
              setActiveGroupBy(active?.id);
            }}
            onDragEnd={({over, active}) => {
              if (over && over.id !== active.id) {
                onChange(arrayMove(columns, Number(active.id), Number(over.id)));
              }
              setActiveGroupBy(undefined);
            }}
            onDragCancel={() => {
              setActiveGroupBy(undefined);
            }}
          >
            <SortableContext
              items={columnFieldsAsString}
              strategy={verticalListSortingStrategy}
            >
              {columns.map((column, index) => (
                <SortableQueryField
                  key={`groupby-${index}`}
                  index={String(index)}
                  value={column}
                  fieldOptions={filteredFieldOptions}
                  onChange={value => handleSelect(value, index)}
                  onDelete={() => handleRemove(index)}
                  actions={actions}
                  wrapperStyle={getStyle}
                />
              ))}
            </SortableContext>
            {createPortal(
              <DragOverlay>
                {activeGroupBy ? (
                  <QueryField
                    value={columns[Number(activeGroupBy)]}
                    fieldOptions={filteredFieldOptions}
                    onChange={value => handleSelect(value, Number(activeGroupBy))}
                    actions={actions}
                    wrapperStyle={getStyle({
                      index: Number(activeGroupBy),
                      isDragging: true,
                      isSorting: false,
                    })}
                    ghost
                  />
                ) : null}
              </DragOverlay>,
              document.body
            )}
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
