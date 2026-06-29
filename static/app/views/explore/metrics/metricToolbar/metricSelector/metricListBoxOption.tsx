import {useCallback, useRef} from 'react';
import {useOption} from '@react-aria/listbox';
import {mergeProps, mergeRefs} from '@react-aria/utils';
import {type ComboBoxState} from '@react-stately/combobox';
import type {Node} from '@react-types/shared';

import {LeadWrap} from '@sentry/scraps/compactSelect';
import {MenuListItem, type MenuListItemProps} from '@sentry/scraps/menuListItem';

import {IconCheckmark} from 'sentry/icons';
import type {MetricSelectorOption} from 'sentry/views/explore/metrics/metricToolbar/metricSelector/types';

interface MetricListBoxOptionProps {
  dataIndex: number;
  item: Node<MetricSelectorOption>;
  listState: ComboBoxState<MetricSelectorOption>;
  size: MenuListItemProps['size'];
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
      'aria-label': option.metricName,
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
      updateSidePanelAnchorOffset?.(ref.current);
    },
  });
  const activeOptionRef = useCallback(
    (element: HTMLLIElement | null) => {
      if (element && isFocused) {
        updateSidePanelAnchorOffset?.(element);
      }
    },
    [isFocused, updateSidePanelAnchorOffset]
  );

  return (
    <MenuListItem
      {...optionPropsMerged}
      as="li"
      data-index={dataIndex}
      ref={mergeRefs(ref, measureRef, activeOptionRef)}
      size={size}
      label={option.label}
      isFocused={isFocused}
      isSelected={isSelected}
      isPressed={isPressed}
      disabled={isDisabled}
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
