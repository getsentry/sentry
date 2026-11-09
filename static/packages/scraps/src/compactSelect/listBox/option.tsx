import type * as React from 'react';
import {createContext, Fragment, useContext, useMemo, useRef} from 'react';
import {useOption} from '@react-aria/listbox';
import {mergeRefs} from '@react-aria/utils';
import type {ListState} from '@react-stately/list';
import type {Node} from '@react-types/shared';
import {IconCheckmark} from '@sentry/icons/checkmark';

import {Checkbox} from '@sentry/scraps/checkbox';
import {HighlightText} from '@sentry/scraps/compactSelect/highlightText';
import {getOptionPaddingLeft, LeadWrap} from '@sentry/scraps/compactSelect/styles';
import type {OptionPosition} from '@sentry/scraps/compactSelect/utils';
import {
  ControlContext,
  ListItem,
  useReserveLeadingSlot,
  type ListItemProps,
} from '@sentry/scraps/menu';

export const ListBoxDetailsHoverContext = createContext<
  ((isHovered: boolean, event: React.PointerEvent) => void) | undefined
>(undefined);

export interface ListBoxOptionProps {
  item: Node<any>;
  listState: ListState<any>;
  size: ListItemProps['size'];
  'data-index'?: number;
  /**
   * Set by a virtualized list, which mounts only some of its options, so
   * screen readers can announce the option's position.
   */
  position?: OptionPosition;
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
  position,
  ref: refProp,
  'data-index': dataIndex,
}: ListBoxOptionProps) {
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
    showDetailsInOverlay,
  } = item.props;
  const multiple = selectionMode
    ? selectionMode === 'multiple'
    : listState.selectionManager.selectionMode === 'multiple';

  const {optionProps, labelProps, isSelected, isFocused, isDisabled, isPressed} =
    useOption({key: item.key, 'aria-label': item['aria-label']}, listState, ref);

  const {search, highlightSearch} = useContext(ControlContext);
  const onDetailsHoverChange = useContext(ListBoxDetailsHoverContext);
  const renderedLabel =
    highlightSearch && search && typeof label === 'string' ? (
      <HighlightText text={label} query={search} />
    ) : (
      label
    );

  // Not memoized: optionProps contains press event handlers from useOption/usePress
  // that capture the current selection state and must stay up-to-date.

  const labelPropsMemo = useMemo(
    () => ({...labelProps, as: typeof label === 'string' ? 'p' : 'div'}) as const,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [labelProps.id, label]
  );

  const reserveLeadingSlot = useReserveLeadingSlot();
  const {leadingItems}: Pick<ListItemProps, 'leadingItems'> = item.props;
  const leadingItemsMemo = useMemo(() => {
    const checkboxSize = size === 'xs' ? 'xs' : 'sm';

    const leading =
      typeof leadingItems === 'function'
        ? leadingItems({disabled: isDisabled, isFocused, isSelected})
        : leadingItems;

    if (hideCheck) {
      return leading;
    }

    return (
      <Fragment>
        <LeadWrap aria-hidden="true">
          {multiple ? (
            <Checkbox
              size={checkboxSize}
              checked={isSelected}
              disabled={isDisabled}
              readOnly
            />
          ) : (
            isSelected && <IconCheckmark size={checkboxSize} variant="accent" />
          )}
        </LeadWrap>
        {/* When any option has an icon, every option gets a 16px icon column so
            labels line up. */}
        {leading || reserveLeadingSlot ? (
          <LeadWrap aria-hidden="true" minWidth={reserveLeadingSlot ? '16px' : undefined}>
            {leading}
          </LeadWrap>
        ) : null}
      </Fragment>
    );
  }, [
    size,
    leadingItems,
    isDisabled,
    isFocused,
    isSelected,
    hideCheck,
    multiple,
    reserveLeadingSlot,
  ]);

  return (
    <ListItem
      {...optionProps}
      aria-posinset={position?.posInSet}
      aria-setsize={position?.setSize}
      data-index={dataIndex}
      ref={mergeRefs(ref, refProp)}
      size={size}
      label={renderedLabel}
      details={showDetails ? details : null}
      disabled={isDisabled}
      isPressed={isPressed}
      isSelected={isSelected}
      isFocused={listState.selectionManager.isFocused && isFocused}
      priority={priority ? 'primary' : 'default'}
      labelProps={labelPropsMemo}
      leadingItems={leadingItemsMemo}
      innerWrapProps={{
        paddingLeft: getOptionPaddingLeft({
          hasCheck: !hideCheck,
          hasLeadingItems: Boolean(leadingItems) || reserveLeadingSlot,
        }),
      }}
      trailingItems={trailingItems}
      showDetailsInOverlay={showDetailsInOverlay}
      onDetailsHoverChange={onDetailsHoverChange}
      tooltip={tooltip}
      tooltipOptions={tooltipOptions}
      data-test-id={item.key}
    />
  );
}
