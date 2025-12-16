import {useCallback, useId, useMemo, useState} from 'react';
import {Item, Section} from '@react-stately/collections';
import * as Sentry from '@sentry/react';
import maxBy from 'lodash/maxBy';
import type {DistributedOmit} from 'type-fest';

import {t} from 'sentry/locale';
import {scheduleMicroTask} from 'sentry/utils/scheduleMicroTask';

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
  /**
   * Number of options above which virtualization will be enabled.
   * Note that virtualization is always disabled if there are sections in the options.
   * @default 150
   */
  virtualizeThreshold?: number;
}

export type SingleSelectProps<Value extends SelectKey> = BaseSelectProps<Value> &
  DistributedOmit<SingleListProps<Value>, 'children' | 'items' | 'grid' | 'label'>;

export type MultipleSelectProps<Value extends SelectKey> = BaseSelectProps<Value> &
  DistributedOmit<MultipleListProps<Value>, 'children' | 'items' | 'grid' | 'label'>;

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
  virtualizeThreshold,

  // Control props
  grid,
  disabled,
  emptyMessage,
  size = 'md',
  closeOnSelect,
  triggerProps,
  menuWidth,
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

  const [measuredMenuWidth, setMeasuredMenuWidth] = useState<number>();
  const [hasMeasured, setHasMeasured] = useState(false);
  const needsMeasuring =
    !menuWidth && !grid && !hasMeasured && shouldVirtualize(options, virtualizeThreshold);

  const menuRef = useCallback(
    (element: HTMLDivElement | null) => {
      if (element && needsMeasuring) {
        setMeasuredMenuWidth(element.offsetWidth + 1);
      }
      // we only measure once, even if the width isn't saved
      // this ensures the menu isn't measured when more options come in that put us over the threshold
      setHasMeasured(true);
    },
    [needsMeasuring]
  );

  const controlDisabled = disabled ?? options?.length === 0;

  const allItemsWithKey = useMemo(() => getItemsWithKeys(options), [options]);
  const longestOptionItemsWithKey = useMemo(() => {
    if (needsMeasuring) {
      const longestOption = maxBy(options, option => {
        if ('options' in option) {
          return 0;
        }
        if (option.textValue) {
          return option.textValue.length;
        }
        if (typeof option.label === 'string') {
          return option.label.length;
        }
        return 0;
      });
      return longestOption ? getItemsWithKeys([longestOption]) : [];
    }
    return [];
  }, [needsMeasuring, options]);
  const itemsWithKey = needsMeasuring ? longestOptionItemsWithKey : allItemsWithKey;

  return (
    <Control
      {...controlProps}
      menuWidth={menuWidth ?? measuredMenuWidth}
      // decrease height to 1px during measuring so that scrollbars are shown & measured
      menuHeight={needsMeasuring ? '1px' : undefined}
      triggerProps={{...triggerProps, id: triggerId}}
      disabled={controlDisabled}
      grid={grid}
      size={size}
      items={allItemsWithKey}
      value={value}
      clearable={clearable}
      onOpenChange={newOpenState => {
        controlProps.onOpenChange?.(newOpenState);
        if (newOpenState) {
          scheduleMicroTask(() => {
            trackVirtualizationMetrics(
              allItemsWithKey,
              virtualizeThreshold,
              typeof controlProps.menuTitle === 'string'
                ? controlProps.menuTitle
                : undefined
            );
          });
        }
      }}
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
      menuRef={menuRef}
    >
      <List
        {...listProps}
        items={itemsWithKey}
        onSectionToggle={onSectionToggle}
        isOptionDisabled={isOptionDisabled}
        size={size}
        sizeLimit={sizeLimit}
        sizeLimitMessage={sizeLimitMessage}
        virtualized={shouldVirtualize(itemsWithKey, virtualizeThreshold)}
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

function shouldVirtualize<Value extends SelectKey>(
  items: Array<SelectOptionOrSection<Value>>,
  virtualizeThreshold = 150
) {
  const hasSections = items.some(item => 'options' in item);
  if (hasSections) {
    return false;
  }

  return items.length > virtualizeThreshold;
}

function trackVirtualizationMetrics<Value extends SelectKey>(
  items: Array<SelectOptionOrSectionWithKey<Value>>,
  virtualizeThreshold = 150,
  title = 'unknown'
) {
  const hasSections = items.some(item => 'options' in item);
  const optionCount = items.reduce((sum, item) => {
    return 'options' in item ? sum + item.options.length : sum + 1;
  }, 0);

  const threshold = virtualizeThreshold ?? 150;

  if (optionCount > threshold) {
    Sentry.metrics.count('scraps.compactSelect.virtualize_over_threshold', 1, {
      attributes: {
        has_sections: hasSections,
        component_title: title,
        count: optionCount,
        threshold,
      },
    });
  }

  Sentry.metrics.distribution('scraps.compactSelect.option_count', optionCount, {
    attributes: {
      has_sections: hasSections,
      component_title: title,
    },
  });
}
