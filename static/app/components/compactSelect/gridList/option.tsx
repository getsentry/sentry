import {Fragment, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {
  AriaGridListItemOptions,
  useGridListItem,
  useGridListSelectionCheckbox,
} from '@react-aria/gridlist';
import {useFocusWithin, useHover} from '@react-aria/interactions';
import {mergeProps} from '@react-aria/utils';
import {ListState} from '@react-stately/list';
import {Node} from '@react-types/shared';

import Checkbox from 'sentry/components/checkbox';
import MenuListItem from 'sentry/components/menuListItem';
import {IconCheckmark} from 'sentry/icons';
import {FormSize} from 'sentry/utils/theme';

interface GridListOptionProps extends AriaGridListItemOptions {
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
    tooltip,
    tooltipOptions,
    selectionMode,
  } = node.props;
  const multiple = selectionMode
    ? selectionMode === 'multiple'
    : listState.selectionManager.selectionMode === 'multiple';

  const {rowProps, gridCellProps, isSelected, isDisabled} = useGridListItem(
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
  const {hoverProps} = useHover({onHoverStart: () => ref.current?.focus()});

  // Show focus effect when document focus is on or inside the item
  const [isFocusWithin, setFocusWithin] = useState(false);
  const {focusWithinProps} = useFocusWithin({onFocusWithinChange: setFocusWithin});

  const checkboxSize = size === 'xs' ? 'xs' : 'sm';
  return (
    <MenuListItem
      {...mergeProps(rowProps, focusWithinProps, hoverProps)}
      ref={ref}
      size={size}
      label={label}
      details={details}
      disabled={isDisabled}
      isFocused={isFocusWithin}
      priority={priority ?? (isSelected && !multiple) ? 'primary' : 'default'}
      innerWrapProps={gridCellProps}
      labelProps={{as: typeof label === 'string' ? 'p' : 'div'}}
      leadingItems={
        <Fragment>
          <CheckWrap multiple={multiple} isSelected={isSelected} role="presentation">
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
          </CheckWrap>
          {leadingItems}
        </Fragment>
      }
      trailingItems={trailingItems}
      tooltip={tooltip}
      tooltipOptions={tooltipOptions}
      data-test-id={node.key}
    />
  );
}

const CheckWrap = styled('div')<{isSelected: boolean; multiple: boolean}>`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 1em;
  height: 1.4em;
  padding-bottom: 1px;
  pointer-events: none;
`;
