import {Fragment, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import type {AriaGridListItemOptions} from '@react-aria/gridlist';
import {useGridListItem, useGridListSelectionCheckbox} from '@react-aria/gridlist';
import {useFocusWithin, useHover} from '@react-aria/interactions';
import {mergeProps} from '@react-aria/utils';
import type {ListState} from '@react-stately/list';
import type {Node} from '@react-types/shared';

import {Checkbox} from '@sentry/scraps/checkbox';
import {LeadWrap} from '@sentry/scraps/compactSelect';
import type {ListItemBase} from '@sentry/scraps/compactSelect/types';
import {
  InnerWrap,
  MenuListItem,
  type MenuListItemProps,
} from '@sentry/scraps/menuListItem';

import {IconCheckmark} from 'sentry/icons';
import type {FormSize} from 'sentry/utils/theme';

export interface GridListOptionProps<
  T extends ListItemBase,
> extends AriaGridListItemOptions {
  listState: ListState<T>;
  node: Node<T>;
  size: FormSize;
  autoHighlighted?: boolean;
}

/**
 * A <li /> element with accessibile behaviors & attributes.
 * https://react-spectrum.adobe.com/react-aria/useGridList.html
 */
export function GridListOption<T extends ListItemBase>({
  node,
  listState,
  size,
  autoHighlighted = false,
}: GridListOptionProps<T>) {
  const ref = useRef<HTMLLIElement>(null);
  const {
    label,
    details,
    trailingItems,
    priority,
    hideCheck,
    tooltip,
    tooltipOptions,
    selectionMode,
  } = node.props;
  const multiple = selectionMode
    ? selectionMode === 'multiple'
    : listState.selectionManager.selectionMode === 'multiple';

  const {rowProps, gridCellProps, isSelected, isDisabled, isPressed} = useGridListItem(
    {node, shouldSelectOnPressUp: true},
    listState,
    ref
  );

  const {
    checkboxProps: {
      isDisabled: _isDisabled,
      isSelected: _isSelected,
      onChange: _onChange,
      ...checkboxProps
    },
  } = useGridListSelectionCheckbox({key: node.key}, listState);

  // Move focus to this item on hover
  const {hoverProps} = useHover({
    // We rely on these props for styling the focus and hover effect
    onHoverStart: () => ref.current?.focus({preventScroll: true}),
  });

  // Show focus effect when document focus is on or inside the item
  const [isFocusWithin, setFocusWithin] = useState(false);
  const {focusWithinProps} = useFocusWithin({onFocusWithinChange: setFocusWithin});

  const rowPropsMerged = mergeProps(rowProps, hoverProps, focusWithinProps);

  const isAutoHighlighted =
    autoHighlighted &&
    !(listState.selectionManager.isFocused && listState.selectionManager.focusedKey);
  const optionIsFocused = isFocusWithin || isAutoHighlighted;

  const labelPropsMemo = useMemo(
    () => ({as: typeof label === 'string' ? 'p' : 'div'}) as const,
    [label]
  );

  const leadingItems = (node.props as MenuListItemProps).leadingItems;
  const leadingItemsMemo = useMemo(() => {
    const checkboxSize = size === 'xs' ? 'xs' : 'sm';

    const leading =
      typeof leadingItems === 'function'
        ? leadingItems({disabled: isDisabled, isFocused: optionIsFocused, isSelected})
        : leadingItems;

    if (hideCheck) {
      return leading;
    }

    return (
      <Fragment>
        <LeadWrap role="presentation">
          {multiple ? (
            <Checkbox
              {...checkboxProps}
              size={checkboxSize}
              checked={isSelected}
              disabled={isDisabled}
              readOnly
            />
          ) : (
            isSelected && <IconCheckmark size={checkboxSize} {...checkboxProps} />
          )}
        </LeadWrap>
        {leading ? <LeadWrap role="presentation">{leading}</LeadWrap> : null}
      </Fragment>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [multiple, isSelected, isDisabled, optionIsFocused, size, leadingItems, hideCheck]);

  return (
    <StyledMenuListItem
      {...rowPropsMerged}
      data-auto-highlighted={isAutoHighlighted ? 'true' : undefined}
      ref={ref}
      size={size}
      label={label}
      details={details}
      disabled={isDisabled}
      isSelected={isSelected}
      isPressed={isPressed}
      isFocused={optionIsFocused}
      priority={(priority ?? (isSelected && !multiple)) ? 'primary' : 'default'}
      innerWrapProps={gridCellProps}
      labelProps={labelPropsMemo}
      leadingItems={leadingItemsMemo}
      trailingItems={trailingItems}
      tooltip={tooltip}
      tooltipOptions={tooltipOptions}
      data-test-id={node.key}
    />
  );
}

const StyledMenuListItem = styled(MenuListItem)`
  > ${InnerWrap} {
    padding-left: ${p => p.theme.space.md};
  }
`;
