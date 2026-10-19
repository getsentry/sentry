import {Fragment, useContext, useMemo, useRef} from 'react';
import type {AriaOptionProps} from '@react-aria/listbox';
import {useOption} from '@react-aria/listbox';
import {mergeRefs} from '@react-aria/utils';
import type {ListState} from '@react-stately/list';
import type {Node} from '@react-types/shared';
import {IconCheckmark} from '@sentry/icons/checkmark';

import {Checkbox} from '@sentry/scraps/checkbox';
import {ControlContext} from '@sentry/scraps/compactSelect/controlContext';
import {HighlightText} from '@sentry/scraps/compactSelect/highlightText';
import {LeadWrap} from '@sentry/scraps/compactSelect/styles';
import {Menu, type ListItemProps} from '@sentry/scraps/menu';

export interface ListBoxOptionProps extends AriaOptionProps {
  item: Node<any>;
  listState: ListState<any>;
  size: ListItemProps['size'];
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
        {leading ? <LeadWrap aria-hidden="true">{leading}</LeadWrap> : null}
      </Fragment>
    );
  }, [size, leadingItems, isDisabled, isFocused, isSelected, hideCheck, multiple]);

  return (
    <Menu.ListItem
      {...optionProps}
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
      trailingItems={trailingItems}
      showDetailsInOverlay={showDetailsInOverlay}
      tooltip={tooltip}
      tooltipOptions={tooltipOptions}
      data-test-id={item.key}
    />
  );
}
