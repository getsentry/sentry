import {useLayoutEffect, useRef} from 'react';
import {useOption} from '@react-aria/listbox';
import {mergeProps, mergeRefs} from '@react-aria/utils';
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
  updateSidePanelAnchorOffset?: (activeOptionElement?: HTMLElement | null) => void;
}

export function MetricListBoxOption({
  item,
  listState,
  size,
  dataIndex,
  measureRef,
  updateSidePanelAnchorOffset,
}: MetricListBoxOptionProps) {
  const ref = useRef<HTMLLIElement>(null);
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
  // oxlint-disable-next-line react/refs
  const optionPropsMerged = mergeProps(optionProps, {
    onMouseEnter: () => {
      listState.selectionManager.setFocused(true);
      listState.selectionManager.setFocusedKey(item.key);
      updateSidePanelAnchorOffset?.(ref.current);
    },
  });
  // Keep the latest updater in a ref so that a new function identity (which
  // happens whenever the selector re-renders with new placement/focus state)
  // does not re-trigger anchoring. Calling it from a ref callback whose
  // identity depended on the updater caused an infinite update loop.
  const updateSidePanelAnchorOffsetRef = useRef(updateSidePanelAnchorOffset);
  useLayoutEffect(() => {
    updateSidePanelAnchorOffsetRef.current = updateSidePanelAnchorOffset;
  }, [updateSidePanelAnchorOffset]);

  useLayoutEffect(() => {
    if (isFocused && ref.current) {
      updateSidePanelAnchorOffsetRef.current?.(ref.current);
    }
  }, [isFocused]);

  return (
    <ListItem
      {...optionPropsMerged}
      as="li"
      data-index={dataIndex}
      ref={mergeRefs(ref, measureRef)}
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
