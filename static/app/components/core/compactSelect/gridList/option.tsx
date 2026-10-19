import {Fragment, useContext, useMemo, useRef, useState} from 'react';
import type {AriaGridListItemOptions} from '@react-aria/gridlist';
import {useGridListItem, useGridListSelectionCheckbox} from '@react-aria/gridlist';
import {useFocusWithin, useHover} from '@react-aria/interactions';
import {mergeProps} from '@react-aria/utils';
import type {ListState} from '@react-stately/list';
import type {Node} from '@react-types/shared';
import {IconCheckmark} from '@sentry/icons/checkmark';

import {Checkbox} from '@sentry/scraps/checkbox';
import {ControlContext} from '@sentry/scraps/compactSelect/controlContext';
import {HighlightText} from '@sentry/scraps/compactSelect/highlightText';
import {LeadWrap} from '@sentry/scraps/compactSelect/styles';
import type {ListItemBase} from '@sentry/scraps/compactSelect/types';
import {Menu, type ListItemProps} from '@sentry/scraps/menu';
import type {FormSize} from '@sentry/scraps/theme';

export interface GridListOptionProps<
  T extends ListItemBase,
> extends AriaGridListItemOptions {
  listState: ListState<T>;
  node: Node<T>;
  size: FormSize;
}

/**
 * A <li /> element with accessibile behaviors & attributes.
 * https://react-spectrum.adobe.com/react-aria/useGridList.html
 */
export function GridListOption<T extends ListItemBase>({
  node,
  listState,
  size,
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

  const {rowProps, gridCellProps, isSelected, isDisabled, isPressed, isFocused} =
    useGridListItem({node, shouldSelectOnPressUp: true}, listState, ref);

  const {search, highlightSearch} = useContext(ControlContext);
  const renderedLabel =
    highlightSearch && search && typeof label === 'string' ? (
      <HighlightText text={label} query={search} />
    ) : (
      label
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

  const labelPropsMemo = useMemo(
    () => ({as: typeof label === 'string' ? 'p' : 'div'}) as const,
    [label]
  );

  const {leadingItems}: Pick<ListItemProps, 'leadingItems'> = node.props;
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
            isSelected && (
              <IconCheckmark size={checkboxSize} variant="accent" {...checkboxProps} />
            )
          )}
        </LeadWrap>
        {leading ? <LeadWrap role="presentation">{leading}</LeadWrap> : null}
      </Fragment>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [multiple, isSelected, isDisabled, isFocused, size, leadingItems, hideCheck]);

  return (
    <Menu.ListItem
      {...rowPropsMerged}
      ref={ref}
      size={size}
      label={renderedLabel}
      details={details}
      disabled={isDisabled}
      isSelected={isSelected}
      isPressed={isPressed}
      isFocused={isFocusWithin}
      priority={priority ? 'primary' : 'default'}
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
