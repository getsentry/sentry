import {Fragment, useCallback, useMemo, useRef} from 'react';
import type {AriaListBoxOptions} from '@react-aria/listbox';
import {useListBox} from '@react-aria/listbox';
import {mergeProps, mergeRefs} from '@react-aria/utils';
import {Virtualizer} from '@react-aria/virtualizer';
import {ListLayout} from '@react-stately/layout';
import type {ListState} from '@react-stately/list';
import type {CollectionChildren} from '@react-types/shared';

import {
  ListLabel,
  ListSeparator,
  ListWrap,
  SizeLimitMessage,
} from 'sentry/components/core/compactSelect/styles';
import type {SelectKey, SelectSection} from 'sentry/components/core/compactSelect/types';
import {t} from 'sentry/locale';
import type {FormSize} from 'sentry/utils/theme';

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
  ref?: React.Ref<HTMLUListElement>;
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
  /**
   * When true, the list box will be virtualized. Useful for improving performance
   * of rendering large lists.
   */
  virtualized?: boolean;
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
export function ListBox({
  ref,
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
  virtualized = false,
  ...props
}: ListBoxProps) {
  const listElementRef = useRef<HTMLUListElement>(null);
  const {listBoxProps, labelProps} = useListBox(
    {
      ...props,
      label,
      shouldFocusWrap,
      shouldFocusOnHover,
      shouldSelectOnPressUp: true,
    },
    listState,
    listElementRef
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLUListElement>) => {
    const continueCallback = keyDownHandler?.(e);
    // Prevent list box from clearing value on Escape key press
    if (continueCallback && e.key !== 'Escape') {
      listBoxProps.onKeyDown?.(e);
    }
  };

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

  const renderItem = useCallback(
    // TODO: Specific type for item
    (type: string, item: any) => {
      if (hiddenOptions.has(item.key)) {
        // TODO: This is supposed to hide elements as they're excluded during search, but
        // it results in a maximum update depth error. Possibly due to updating all of the nodes
        // to null
        return null;
      }

      if (type === 'section') {
        // TODO: The line separator that's rendered here is not visible when virtualized
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
    },
    [hiddenOptions, listState, size, showSectionHeaders, showDetails, onSectionToggle]
  );

  function getEstimatedRowHeight(formSize: FormSize) {
    // TODO: Check if there are better ways to access this through theme
    switch (formSize) {
      case 'md':
        return 40;
      case 'sm':
        return 36;
      case 'xs':
        return 28;
      default:
        return 0;
    }
  }

  const content =
    virtualized && overlayIsOpen ? (
      <Virtualizer
        key={`${hiddenOptions.size}-${listState.selectionManager.selectedKeys.size}`}
        // TODO: The key down handler does not trigger the correct focus when virtualized in its current state
        onKeyDown={onKeyDown}
        style={{
          // TODO: Height and width should be override-able
          height: 'fit-content',
          maxHeight: '300px',
          width: 'max(400px, 100%)',
          overflow: 'auto',
        }}
        layout={
          new ListLayout({
            padding: 4,
            estimatedRowHeight: getEstimatedRowHeight(size),
            estimatedHeadingHeight: getEstimatedRowHeight(size),
          })
        }
        collection={listState.collection}
      >
        {renderItem}
      </Virtualizer>
    ) : (
      <ListWrap
        {...mergeProps(listBoxProps, props)}
        onKeyDown={onKeyDown}
        ref={mergeRefs(listElementRef, ref)}
      >
        {overlayIsOpen && listItems.map(item => renderItem(item.type, item))}

        {!hasSearch && hiddenOptions.size > 0 && (
          <SizeLimitMessage>
            {sizeLimitMessage ?? t('Use search to find more options…')}
          </SizeLimitMessage>
        )}
      </ListWrap>
    );

  return (
    <Fragment>
      {listItems.length !== 0 && <ListSeparator role="separator" />}
      {listItems.length !== 0 && label && <ListLabel {...labelProps}>{label}</ListLabel>}
      {content}
    </Fragment>
  );
}
