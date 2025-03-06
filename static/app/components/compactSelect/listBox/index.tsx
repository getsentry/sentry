import {forwardRef, Fragment, useCallback, useMemo, useRef} from 'react';
import type {AriaListBoxOptions} from '@react-aria/listbox';
import {useListBox} from '@react-aria/listbox';
import {mergeProps} from '@react-aria/utils';
import type {ListState} from '@react-stately/list';
import type {CollectionChildren} from '@react-types/shared';

import {t} from 'sentry/locale';
import mergeRefs from 'sentry/utils/mergeRefs';
import type {FormSize} from 'sentry/utils/theme';

import {ListLabel, ListSeparator, ListWrap, SizeLimitMessage} from '../styles';
import type {SelectKey, SelectSection} from '../types';

import {ListBoxOption} from './option';
import {ListBoxSection} from './section';

interface ListBoxProps
  extends Omit<
      React.HTMLAttributes<HTMLUListElement>,
      'onBlur' | 'onFocus' | 'autoFocus' | 'children'
    >,
    Omit<
      AriaListBoxOptions<any>,
      | 'children'
      | 'items'
      | 'disabledKeys'
      | 'selectedKeys'
      | 'defaultSelectedKeys'
      | 'onSelectionChange'
      | 'autoFocus'
    > {
  /**
   * Keyboard event handler, to be attached to the list (`ul`) element, to seamlessly
   * move focus from one composite list to another when an arrow key is pressed. Returns
   * a boolean indicating whether the keyboard event was intercepted. If yes, then no
   * further callback function should be run.
   */
  keyDownHandler: (e: React.KeyboardEvent<HTMLUListElement>) => boolean;
  /**
   * Object containing the selection state and focus position, needed for
   * `useListBox()`.
   */
  listState: ListState<any>;
  children?: CollectionChildren<any>;
  /**
   * Whether the list is filtered by search query or not.
   * Used to determine whether to show the size limit message or not.
   */
  hasSearch?: boolean;
  /**
   * Set of keys that are hidden from the user (e.g. because not matching search query)
   */
  hiddenOptions?: Set<SelectKey>;
  /**
   * Text label to be rendered as heading on top of grid list.
   */
  label?: React.ReactNode;
  /**
   * To be called when the user toggle-selects a whole section (applicable when sections
   * have `showToggleAllButton` set to true.) Note: this will be called in addition to
   * and before `onChange`.
   */
  onSectionToggle?: (
    section: SelectSection<SelectKey>,
    type: 'select' | 'unselect'
  ) => void;
  /**
   * Used to determine whether to render the list box items or not
   */
  overlayIsOpen?: boolean;
  /**
   * When false, hides option details.
   */
  showDetails?: boolean;
  /**
   * When false, hides section headers in the list box.
   */
  showSectionHeaders?: boolean;
  /**
   * Size of the list box and its items.
   */
  size?: FormSize;
  /**
   * Message to be displayed when some options are hidden due to `sizeLimit`.
   */
  sizeLimitMessage?: string;
}

const EMPTY_SET = new Set<never>();

/**
 * A list box with accessibile behaviors & attributes.
 * https://react-spectrum.adobe.com/react-aria/useListBox.html
 *
 * Unlike grid lists, list boxes are one-dimensional. Users can press Arrow Up/Down to
 * move between options. All interactive elements (buttons/links) inside list box
 * options are unreachable via keyboard (only the options themselves can be focused on).
 * If interactive children are necessary, consider using grid lists instead (by setting
 * the `grid` prop on CompactSelect to true).
 */
const ListBox = forwardRef<HTMLUListElement, ListBoxProps>(function ListBox(
  {
    listState,
    size = 'md',
    shouldFocusWrap = true,
    shouldFocusOnHover = true,
    onSectionToggle,
    sizeLimitMessage,
    keyDownHandler,
    label,
    hiddenOptions = EMPTY_SET,
    hasSearch,
    overlayIsOpen,
    showSectionHeaders = true,
    showDetails = true,
    ...props
  }: ListBoxProps,
  forwarderdRef
) {
  const ref = useRef<HTMLUListElement>(null);
  const {listBoxProps, labelProps} = useListBox(
    {
      ...props,
      label,
      shouldFocusWrap,
      shouldFocusOnHover,
      shouldSelectOnPressUp: true,
    },
    listState,
    ref
  );

  const onKeyDown = useCallback<React.KeyboardEventHandler<HTMLUListElement>>(
    e => {
      const continueCallback = keyDownHandler?.(e);
      // Prevent list box from clearing value on Escape key press
      if (continueCallback && e.key !== 'Escape') {
        listBoxProps.onKeyDown?.(e);
      }
    },
    [keyDownHandler, listBoxProps]
  );

  const listItems = useMemo(
    () =>
      [...listState.collection].filter(node => {
        if (node.type === 'section') {
          return ![...node.childNodes].every(child => hiddenOptions.has(child.key));
        }

        return !hiddenOptions.has(node.key);
      }),
    [listState.collection, hiddenOptions]
  );

  return (
    <Fragment>
      {listItems.length !== 0 && <ListSeparator role="separator" />}
      {listItems.length !== 0 && label && <ListLabel {...labelProps}>{label}</ListLabel>}
      <ListWrap
        {...mergeProps(listBoxProps, props)}
        onKeyDown={onKeyDown}
        ref={mergeRefs([ref, forwarderdRef])}
      >
        {overlayIsOpen &&
          listItems.map(item => {
            if (item.type === 'section') {
              return (
                <ListBoxSection
                  key={item.key}
                  item={item}
                  listState={listState}
                  hiddenOptions={hiddenOptions}
                  onToggle={onSectionToggle}
                  size={size}
                  showSectionHeaders={showSectionHeaders}
                  showDetails={showDetails}
                />
              );
            }

            return (
              <ListBoxOption
                key={item.key}
                item={item}
                listState={listState}
                size={size}
                showDetails={showDetails}
              />
            );
          })}

        {!hasSearch && hiddenOptions.size > 0 && (
          <SizeLimitMessage>
            {sizeLimitMessage ?? t('Use search to find more options…')}
          </SizeLimitMessage>
        )}
      </ListWrap>
    </Fragment>
  );
});

export {ListBox};
