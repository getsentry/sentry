import {useMemo} from 'react';
import {Item, Section} from '@react-stately/collections';

import {t} from 'sentry/locale';
import domId from 'sentry/utils/domId';

import {Control, ControlProps} from './control';
import {List, MultipleListProps, SingleListProps} from './list';
import {EmptyMessage} from './styles';
import type {
  SelectOption,
  SelectOptionOrSection,
  SelectOptionOrSectionWithKey,
  SelectSection,
} from './types';

export type {SelectOption, SelectOptionOrSection, SelectSection};

interface BaseSelectProps<Value extends React.Key> extends ControlProps {
  options: SelectOptionOrSection<Value>[];
}

export interface SingleSelectProps<Value extends React.Key>
  extends BaseSelectProps<Value>,
    Omit<
      SingleListProps<Value>,
      'children' | 'items' | 'grid' | 'compositeIndex' | 'label'
    > {}

export interface MultipleSelectProps<Value extends React.Key>
  extends BaseSelectProps<Value>,
    Omit<
      MultipleListProps<Value>,
      'children' | 'items' | 'grid' | 'compositeIndex' | 'label'
    > {}

export type SelectProps<Value extends React.Key> =
  | SingleSelectProps<Value>
  | MultipleSelectProps<Value>;

// A series of TS function overloads to properly parse prop types across 2 dimensions:
// option value types (number vs string), and selection mode (singular vs multiple)
function CompactSelect<Value extends number>(props: SelectProps<Value>): JSX.Element;
function CompactSelect<Value extends string>(props: SelectProps<Value>): JSX.Element;
function CompactSelect<Value extends React.Key>(props: SelectProps<Value>): JSX.Element;

/**
 * Flexible select component with a customizable trigger button
 */
function CompactSelect<Value extends React.Key>({
  // List props
  options,
  value,
  defaultValue,
  onChange,
  multiple,
  disallowEmptySelection,
  isOptionDisabled,
  sizeLimit,
  sizeLimitMessage,

  // Control props
  grid,
  disabled,
  emptyMessage,
  size = 'md',
  closeOnSelect,
  triggerProps,
  ...controlProps
}: SelectProps<Value>) {
  const triggerId = useMemo(() => domId('select-trigger-'), []);

  // Combine list props into an object with two clearly separated types, one where
  // `multiple` is true and the other where it's not. Necessary to avoid TS errors.
  const listProps = useMemo(() => {
    if (multiple) {
      return {multiple, value, defaultValue, onChange, closeOnSelect, grid};
    }
    return {multiple, value, defaultValue, onChange, closeOnSelect, grid};
  }, [multiple, value, defaultValue, onChange, closeOnSelect, grid]);

  const optionsWithKey = useMemo<SelectOptionOrSectionWithKey<Value>[]>(
    () =>
      options.map((item, i) => ({
        ...item,
        // options key has to be unique to the current list of options,
        // else we risk of a duplicate key error and end up confusing react
        // which ultimately fails to call the correct item handlers
        key: 'options' in item ? item.key ?? `options-${i}` : item.value,
      })),
    [options]
  );

  const controlDisabled = useMemo(
    () => disabled ?? options?.length === 0,
    [disabled, options]
  );

  return (
    <Control
      {...controlProps}
      triggerProps={{...triggerProps, id: triggerId}}
      disabled={controlDisabled}
      grid={grid}
      size={size}
    >
      <List
        {...listProps}
        items={optionsWithKey}
        disallowEmptySelection={disallowEmptySelection}
        isOptionDisabled={isOptionDisabled}
        size={size}
        sizeLimit={sizeLimit}
        sizeLimitMessage={sizeLimitMessage}
        aria-labelledby={triggerId}
      >
        {(item: SelectOptionOrSection<Value>) => {
          if ('options' in item) {
            return (
              <Section key={item.key} title={item.label}>
                {item.options.map(opt => (
                  <Item key={opt.value} {...opt}>
                    {opt.label}
                  </Item>
                ))}
              </Section>
            );
          }

          return (
            <Item key={item.value} {...item}>
              {item.label}
            </Item>
          );
        }}
      </List>

      {/* Only displayed when List is empty */}
      <EmptyMessage>{emptyMessage ?? t('No options found')}</EmptyMessage>
    </Control>
  );
}

export {CompactSelect};
