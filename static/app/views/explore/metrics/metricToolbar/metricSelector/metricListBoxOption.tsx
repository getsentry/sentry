import {useOption} from '@react-aria/listbox';
import {mergeProps, useObjectRef} from '@react-aria/utils';
import {type ComboBoxState} from '@react-stately/combobox';
import type {Node} from '@react-types/shared';
import {IconCheckmark} from '@sentry/icons/checkmark';

import {LeadWrap} from '@sentry/scraps/compactSelect';
import {ListItem, type ListItemProps} from '@sentry/scraps/menu';

import {
  isMetricSelectorOption,
  type MetricSelectorItem,
} from 'sentry/views/explore/metrics/metricToolbar/metricSelector/types';

interface MetricListBoxOptionProps {
  dataIndex: number;
  item: Node<MetricSelectorItem>;
  listState: ComboBoxState<MetricSelectorItem>;
  size: ListItemProps['size'];
  measureRef?: React.Ref<HTMLLIElement>;
}

export function MetricListBoxOption({
  item,
  listState,
  size,
  dataIndex,
  measureRef,
}: MetricListBoxOptionProps) {
  // Stable across renders, so the row isn't detached and re-measured each time.
  const ref = useObjectRef(measureRef);
  const option = item.value!;
  const {optionProps, isFocused, isSelected, isDisabled, isPressed} = useOption(
    {
      key: item.key,
      'aria-label': isMetricSelectorOption(option) ? option.metricName : option.textValue,
      shouldUseVirtualFocus: true,
      shouldSelectOnPressUp: true,
    },
    listState,
    ref
  );
  const optionPropsMerged = mergeProps(optionProps, {
    onMouseEnter: () => {
      listState.selectionManager.setFocused(true);
      listState.selectionManager.setFocusedKey(item.key);
    },
  });

  return (
    <ListItem
      {...optionPropsMerged}
      as="li"
      data-index={dataIndex}
      ref={ref}
      size={size}
      label={option.label}
      isFocused={isFocused}
      isSelected={isSelected}
      isPressed={isPressed}
      disabled={isDisabled}
      tooltip={option.tooltip}
      priority={isSelected ? 'primary' : 'default'}
      leadingItems={
        <LeadWrap aria-hidden="true">
          {isSelected ? <IconCheckmark size="sm" /> : null}
        </LeadWrap>
      }
      trailingItems={option.trailingItems}
    />
  );
}
