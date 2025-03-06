import {Fragment, useMemo, useRef} from 'react';
import type {AriaOptionProps} from '@react-aria/listbox';
import {useOption} from '@react-aria/listbox';
import type {ListState} from '@react-stately/list';
import type {Node} from '@react-types/shared';

import {Checkbox} from 'sentry/components/core/checkbox';
import MenuListItem from 'sentry/components/menuListItem';
import {IconCheckmark} from 'sentry/icons';
import type {FormSize} from 'sentry/utils/theme';

import {CheckWrap} from '../styles';

interface ListBoxOptionProps extends AriaOptionProps {
  item: Node<any>;
  listState: ListState<any>;
  size: FormSize;
  showDetails?: boolean;
}

/**
 * A <li /> element with accessibile behaviors & attributes.
 * https://react-spectrum.adobe.com/react-aria/useListBox.html
 */
export function ListBoxOption({
  item,
  listState,
  size,
  showDetails = true,
}: ListBoxOptionProps) {
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
    showDetailsInOverlay,
  } = item.props;
  const multiple = selectionMode
    ? selectionMode === 'multiple'
    : listState.selectionManager.selectionMode === 'multiple';

  const {optionProps, labelProps, isSelected, isFocused, isDisabled, isPressed} =
    useOption({key: item.key, 'aria-label': item['aria-label']}, listState, ref);

  const optionPropsMemo = useMemo(
    () => optionProps,
    // Only update optionProps when a relevant state (selection/focus/disable) changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isSelected, isFocused, isDisabled]
  );

  const labelPropsMemo = useMemo(
    () => ({...labelProps, as: typeof label === 'string' ? 'p' : 'div'}) as const,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [labelProps.id, label]
  );

  const leadingItemsMemo = useMemo(() => {
    const checkboxSize = size === 'xs' ? 'xs' : 'sm';

    if (hideCheck && !leadingItems) {
      return null;
    }

    return (
      <Fragment>
        {!hideCheck && (
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
        )}
        {leadingItems}
      </Fragment>
    );
  }, [multiple, isSelected, isDisabled, size, leadingItems, hideCheck]);

  return (
    <MenuListItem
      {...optionPropsMemo}
      ref={ref}
      size={size}
      label={label}
      details={showDetails ? details : null}
      disabled={isDisabled}
      isPressed={isPressed}
      isSelected={isSelected}
      isFocused={listState.selectionManager.isFocused && isFocused}
      priority={priority ?? (isSelected && !multiple) ? 'primary' : 'default'}
      labelProps={labelPropsMemo}
      leadingItems={leadingItemsMemo}
      trailingItems={trailingItems}
      showDetailsInOverlay={showDetailsInOverlay}
      tooltip={tooltip}
      tooltipOptions={tooltipOptions}
      data-test-id={item.key}
    />
  );
}
