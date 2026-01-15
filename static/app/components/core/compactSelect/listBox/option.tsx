import {Fragment, useMemo, useRef} from 'react';
import styled from '@emotion/styled';
import type {AriaOptionProps} from '@react-aria/listbox';
import {useOption} from '@react-aria/listbox';
import {mergeRefs} from '@react-aria/utils';
import type {ListState} from '@react-stately/list';
import type {Node} from '@react-types/shared';

import {Checkbox} from 'sentry/components/core/checkbox';
import {LeadWrap} from 'sentry/components/core/compactSelect/styles';
import {
  InnerWrap,
  MenuListItem,
  type MenuListItemProps,
} from 'sentry/components/core/menuListItem';
import {IconCheckmark} from 'sentry/icons';
import {space} from 'sentry/styles/space';

export interface ListBoxOptionProps extends AriaOptionProps {
  item: Node<any>;
  listState: ListState<any>;
  size: MenuListItemProps['size'];
  'data-index'?: number;
  ref?: React.Ref<HTMLLIElement>;
  showDetails?: boolean;
}

/**
 * A <li /> element with accessible behaviors & attributes.
 * https://react-spectrum.adobe.com/react-aria/useListBox.html
 */
export function ListBoxOption({
  item,
  listState,
  size,
  showDetails = true,
  ref: refProp,
  'data-index': dataIndex,
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

    const leading =
      typeof leadingItems === 'function'
        ? leadingItems({disabled: isDisabled, isFocused, isSelected})
        : leadingItems;

    if (hideCheck && !leading) {
      return null;
    }

    return (
      <Fragment>
        {!hideCheck && (
          <LeadWrap aria-hidden="true">
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
          </LeadWrap>
        )}
        {leading ? <LeadWrap aria-hidden="true">{leading}</LeadWrap> : null}
      </Fragment>
    );
  }, [size, leadingItems, isDisabled, isFocused, isSelected, hideCheck, multiple]);

  return (
    <StyledMenuListItem
      {...optionPropsMemo}
      data-index={dataIndex}
      ref={mergeRefs(ref, refProp)}
      size={size}
      label={label}
      details={showDetails ? details : null}
      disabled={isDisabled}
      isPressed={isPressed}
      isSelected={isSelected}
      isFocused={listState.selectionManager.isFocused && isFocused}
      priority={(priority ?? (isSelected && !multiple)) ? 'primary' : 'default'}
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

const StyledMenuListItem = styled(MenuListItem)`
  > ${InnerWrap} {
    padding-left: ${space(1)};
  }
`;
