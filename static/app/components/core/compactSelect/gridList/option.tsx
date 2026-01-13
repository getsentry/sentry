import {Fragment, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import type {AriaGridListItemOptions} from '@react-aria/gridlist';
import {useGridListItem, useGridListSelectionCheckbox} from '@react-aria/gridlist';
import {useFocusWithin, useHover} from '@react-aria/interactions';
import {mergeProps} from '@react-aria/utils';
import type {ListState} from '@react-stately/list';
import type {Node} from '@react-types/shared';

import {Checkbox} from 'sentry/components/core/checkbox';
import {LeadWrap} from 'sentry/components/core/compactSelect/styles';
import {InnerWrap, MenuListItem} from 'sentry/components/core/menuListItem';
import {IconCheckmark} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import type {FormSize} from 'sentry/utils/theme';

export interface GridListOptionProps extends AriaGridListItemOptions {
  listState: ListState<any>;
  node: Node<any>;
  size: FormSize;
}

/**
 * A <li /> element with accessibile behaviors & attributes.
 * https://react-spectrum.adobe.com/react-aria/useGridList.html
 */
export function GridListOption({node, listState, size}: GridListOptionProps) {
  const ref = useRef<HTMLLIElement>(null);
  const {
    label,
    details,
    leadingItems,
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

  const {rowProps, gridCellProps, isSelected, isDisabled, isPressed, isFocused} =
    useGridListItem({node, shouldSelectOnPressUp: true}, listState, ref);

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

  const rowPropsMemo = useMemo(
    () => mergeProps(rowProps, hoverProps, focusWithinProps),
    // Only update optionProps when a relevant state (selection/focus/disable) changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isSelected, isDisabled]
  );

  const gridCellPropsMemo = useMemo(
    () => gridCellProps,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isSelected, isDisabled]
  );

  const labelPropsMemo = useMemo(
    () => ({as: typeof label === 'string' ? 'p' : 'div'}) as const,
    [label]
  );

  const leadingItemsMemo = useMemo(() => {
    const checkboxSize = size === 'xs' ? 'xs' : 'sm';

    if (hideCheck && !leadingItems) {
      return null;
    }

    const leading =
      typeof leadingItems === 'function'
        ? leadingItems({disabled: isDisabled, isFocused, isSelected})
        : leadingItems;

    return (
      <Fragment>
        {!hideCheck && (
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
        )}
        {leading ? <LeadWrap role="presentation">{leading}</LeadWrap> : null}
      </Fragment>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [multiple, isSelected, isDisabled, size, leadingItems, hideCheck]);

  return (
    <StyledMenuListItem
      {...rowPropsMemo}
      ref={ref}
      size={size}
      label={label}
      details={details}
      disabled={isDisabled}
      isSelected={isSelected}
      isPressed={isPressed}
      isFocused={isFocusWithin}
      priority={(priority ?? (isSelected && !multiple)) ? 'primary' : 'default'}
      innerWrapProps={gridCellPropsMemo}
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
    padding-left: ${space(1)};
  }
`;
