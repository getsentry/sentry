import {useId, useMemo} from 'react';
import {Item, Section} from '@react-stately/collections';

import type {DistributiveOmit} from '@sentry/scraps/types';

import {t} from 'sentry/locale';

import {Control, type ControlProps} from './control';
import type {MultipleListProps, SingleListProps} from './list';
import {List} from './list';
import {EmptyMessage} from './styles';
import type {
  SelectKey,
  SelectOption,
  SelectOptionOrSection,
  SelectOptionOrSectionWithKey,
  SelectSection,
} from './types';
import {getItemsWithKeys, shouldCloseOnSelect} from './utils';

export type {SelectOption, SelectOptionOrSection, SelectSection, SelectKey};

interface BaseSelectProps<Value extends SelectKey>
  extends Omit<ControlProps, 'onClear' | 'clearable'> {
  options: Array<SelectOptionOrSection<Value>>;
}

export type SingleSelectProps<Value extends SelectKey> = BaseSelectProps<Value> &
  DistributiveOmit<
    SingleListProps<Value>,
    'children' | 'items' | 'grid' | 'compositeIndex' | 'label'
  >;

export type MultipleSelectProps<Value extends SelectKey> = BaseSelectProps<Value> &
  DistributiveOmit<
    MultipleListProps<Value>,
    'children' | 'items' | 'grid' | 'compositeIndex' | 'label'
  >;

export type SelectProps<Value extends SelectKey> =
  | SingleSelectProps<Value>
  | MultipleSelectProps<Value>;

// A series of TS function overloads to properly parse prop types across 2 dimensions:
// option value types (number vs string), and selection mode (singular vs multiple)
export function CompactSelect<Value extends number>(
  props: SelectProps<Value>
): React.JSX.Element;
export function CompactSelect<Value extends string>(
  props: SelectProps<Value>
): React.JSX.Element;
export function CompactSelect<Value extends SelectKey>(
  props: SelectProps<Value>
): React.JSX.Element;

/**
 * Flexible select component with a customizable trigger button
 */
export function CompactSelect<Value extends SelectKey>({
  // List props
  options,
  value,
  onChange,
  onSectionToggle,
  multiple,
  clearable,
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
  const triggerId = useId();

  // Combine list props into an object with two clearly separated types, one where
  // `multiple` is true and the other where it's not. Necessary to avoid TS errors.
  // also multiple:false must be split into clearable true/false to satisfy TS
  const listProps = useMemo(() => {
    if (multiple) {
      return {
        clearable,
        multiple,
        value,
        onChange,
        closeOnSelect,
        grid,
      };
    }

    if (clearable) {
      return {
        clearable,
        multiple,
        value,
        onChange,
        closeOnSelect,
        grid,
      };
    }

    return {
      clearable,
      multiple,
      value,
      onChange,
      closeOnSelect,
      grid,
    };
  }, [multiple, clearable, value, onChange, closeOnSelect, grid]);

  const itemsWithKey = useMemo(() => getItemsWithKeys(options), [options]);

  const controlDisabled = disabled ?? options?.length === 0;

  return (
    <Control
      {...controlProps}
      triggerProps={{...triggerProps, id: triggerId}}
      disabled={controlDisabled}
      grid={grid}
      size={size}
      clearable={clearable}
      onClear={({overlayState}) => {
        if (clearable) {
          if (multiple) {
            onChange([]);
          } else {
            onChange(undefined);
          }
          if (shouldCloseOnSelect?.({...listProps, selectedOptions: []})) {
            overlayState?.close();
          }
        }
      }}
    >
      <List
        {...listProps}
        items={itemsWithKey}
        onSectionToggle={onSectionToggle}
        isOptionDisabled={isOptionDisabled}
        size={size}
        sizeLimit={sizeLimit}
        sizeLimitMessage={sizeLimitMessage}
        aria-labelledby={triggerId}
      >
        {(item: SelectOptionOrSectionWithKey<Value>) => {
          if ('options' in item) {
            return (
              <Section key={item.key} title={item.label}>
                {item.options.map(opt => (
                  <Item {...opt} key={opt.key}>
                    {opt.label}
                  </Item>
                ))}
              </Section>
            );
          }

          return (
            <Item {...item} key={item.key}>
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
