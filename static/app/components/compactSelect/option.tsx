import {Fragment, useRef} from 'react';
import styled from '@emotion/styled';
import {AriaOptionProps, useOption} from '@react-aria/listbox';
import {ListState} from '@react-stately/list';
import {Node} from '@react-types/shared';

import Checkbox from 'sentry/components/checkbox';
import MenuListItem from 'sentry/components/menuListItem';
import {IconCheckmark} from 'sentry/icons';
import {FormSize} from 'sentry/utils/theme';

interface OptionProps extends AriaOptionProps {
  item: Node<any>;
  /**
   * Whether the list box (ul element) has focus. If not (e.g. if the search input has
   * focus), then Option will not have any focus effect.
   */
  listBoxHasFocus: boolean;
  listState: ListState<any>;
  size: FormSize;
}

/**
 * A <li /> element with accessibile behaviors & attributes.
 * https://react-spectrum.adobe.com/react-aria/useListBox.html
 */
export function Option({item, listState, listBoxHasFocus, size}: OptionProps) {
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
  } = item.props;
  const multiple = selectionMode
    ? selectionMode === 'multiple'
    : listState.selectionManager.selectionMode === 'multiple';

  const {optionProps, labelProps, isSelected, isFocused, isDisabled} = useOption(
    {key: item.key, 'aria-label': item['aria-label']},
    listState,
    ref
  );

  const checkboxSize = size === 'xs' ? 'xs' : 'sm';
  return (
    <MenuListItem
      {...optionProps}
      ref={ref}
      size={size}
      label={label}
      details={details}
      disabled={isDisabled}
      isFocused={listBoxHasFocus && isFocused}
      priority={priority ?? (isSelected && !multiple) ? 'primary' : 'default'}
      labelProps={{...labelProps, as: typeof label === 'string' ? 'p' : 'div'}}
      leadingItems={
        <Fragment>
          <CheckWrap multiple={multiple} isSelected={isSelected} aria-hidden="true">
            {multiple ? (
              <Checkbox
                size={checkboxSize}
                checked={isSelected}
                disabled={isDisabled}
                readOnly
              />
            ) : (
              isSelected && <IconCheckmark size={checkboxSize} />
            )}
          </CheckWrap>
          {leadingItems}
        </Fragment>
      }
      trailingItems={trailingItems}
      tooltip={tooltip}
      tooltipOptions={tooltipOptions}
      data-test-id={item.key}
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
