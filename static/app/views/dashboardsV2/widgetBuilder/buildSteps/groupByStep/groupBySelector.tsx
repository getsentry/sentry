import React, {Fragment, useEffect, useMemo, useState} from 'react';
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
import usePrevious from 'sentry/utils/usePrevious';
import {FieldValueKind} from 'sentry/views/eventsV2/table/types';
import {generateFieldOptions} from 'sentry/views/eventsV2/utils';

import {QueryField} from './queryField';
import {SortableQueryField} from './sortableQueryField';

const GROUP_BY_LIMIT = 20;
const EMPTY_FIELD: QueryFieldValue = {kind: FieldValueKind.FIELD, field: ''};
import isEqual from 'lodash/isEqual';

interface Props {
  fieldOptions: ReturnType<typeof generateFieldOptions>;
  onChange: (fields: QueryFieldValue[]) => void;
  columns?: QueryFieldValue[];
}

interface State {
  activeItem: string | null;
  items: string[];
}

export function GroupBySelector({fieldOptions, columns = [], onChange}: Props) {
  const [state, setState] = useState<State>(getState);
  const previousColumns = usePrevious(columns);

  useEffect(() => {
    let shouldCancelUpdates = false;

    if (!isEqual(previousColumns, columns)) {
      if (shouldCancelUpdates) {
        return undefined;
      }

      setState(getState());
    }

    return () => {
      shouldCancelUpdates = true;
    };
  }, [columns, previousColumns]);

  // useEffect(() => {
  //   const newColumns = state.items.reduce((acc, item, index) => {
  //     acc[index] = columns[Number(item)];
  //     return acc;
  //   }, [] as QueryFieldValue[]);

  //   onChange(newColumns);
  // }, [state.items]);

  function getState() {
    return {
      activeItem: null,
      items: columns.reduce((acc, _column, index) => {
        acc.push(String(index));
        return acc;
      }, [] as string[]),
    };
  }

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
            collisionDetection={closestCenter}
            onDragStart={({active}) => {
              if (!active) {
                return;
              }
              setState(prevState => ({...prevState, activeItem: active.id}));
            }}
            onDragEnd={({over, active}) => {
              if (over && active.id !== over.id) {
                const oldIndex = state.items.indexOf(active.id);
                const newIndex = state.items.indexOf(over.id);
                const newItems = arrayMove(state.items, oldIndex, newIndex);

                setState({activeItem: null, items: newItems});
                return;
              }

              setState({...state, activeItem: null});
            }}
          >
            <SortableContext items={state.items} strategy={verticalListSortingStrategy}>
              {state.items.map((item, index) => (
                <SortableQueryField
                  key={index}
                  id={item}
                  value={columns[Number(item)]}
                  fieldOptions={filteredFieldOptions}
                  onChange={value => handleSelect(value, index)}
                  onDelete={() => handleRemove(index)}
                  canDrag={canDrag}
                  canDelete={canDelete}
                />
              ))}
            </SortableContext>
            <DragOverlay>
              {state.activeItem ? (
                <Ghost>
                  <QueryField
                    value={columns[Number(state.activeItem)]}
                    fieldOptions={filteredFieldOptions}
                    onChange={value => handleSelect(value, Number(state.activeItem))}
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
