import {Fragment, useEffect, useMemo, useRef} from 'react';
import type {AriaListBoxOptions} from '@react-aria/listbox';
import {useListBox} from '@react-aria/listbox';
import {mergeProps, mergeRefs} from '@react-aria/utils';
import type {ListState} from '@react-stately/list';
import type {CollectionChildren} from '@react-types/shared';
import {useVirtualizer} from '@tanstack/react-virtual';

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
   * Enable virtualization for better performance with large lists.
   */
  virtualized?: boolean;
  /**
   * Options for the virtualized list.
   */
  virtualizedMenuOptions?: {
    itemHeight: number;
    maxHeight: number;
    minWidth: number;
    overscan: number;
  };
}

const EMPTY_SET = new Set<never>();
const DEFAULT_ITEM_HEIGHT = 40;
const DEFAULT_OVERSCAN = 10;
const DEFAULT_MIN_WIDTH = 400;
const DEFAULT_MAX_HEIGHT = 300;

/**
 * A list box with accessibile behaviors & attributes.
 * https://react-spectrum.adobe.com/react-aria/useListBox.html
 *
 * Unlike grid lists, list boxes are one-dimensional. Users can press Arrow Up/Down to
 * move between options. All interactive elements (buttons/links) inside list box
 * options are unreachable via keyboard (only the options themselves can be focused on).
 * If interactive children are necessary, consider using grid lists instead (by setting
 * the `grid` prop on CompactSelect to true).
 *
 * When `virtualized` is true, the list will be virtualized for better performance
 * with large datasets. This requires `virtualizedMenuOptions` to be provided.
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
  virtualizedMenuOptions = {
    itemHeight: DEFAULT_ITEM_HEIGHT,
    maxHeight: DEFAULT_MAX_HEIGHT,
    minWidth: DEFAULT_MIN_WIDTH,
    overscan: DEFAULT_OVERSCAN,
  },
  ...props
}: ListBoxProps) {
  const listElementRef = useRef<HTMLUListElement>(null);
  const scrollElementRef = useRef<HTMLDivElement>(null);

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

  const virtualizer = useVirtualizer({
    count: listItems.length,
    getScrollElement: () => scrollElementRef.current,
    estimateSize: () => virtualizedMenuOptions.itemHeight,
    overscan: virtualizedMenuOptions.overscan,
  });

  const virtualItems = virtualizer?.getVirtualItems() ?? [];

  // Handle focus wrapping manually for virtualized lists
  useEffect(() => {
    if (!virtualized || !listState.selectionManager.focusedKey) return;

    const focusedIndex = listItems.findIndex(
      item => item.key === listState.selectionManager.focusedKey
    );

    if (focusedIndex !== -1) {
      virtualizer.scrollToIndex(focusedIndex);
    }
  }, [listState.selectionManager.focusedKey, virtualized, listItems, virtualizer]);

  const renderListItems = () => {
    const itemsToRender = virtualized
      ? virtualItems
      : listItems.map((item, index) => ({item, index}));

    return itemsToRender.map(virtualOrRegularItem => {
      const item =
        'item' in virtualOrRegularItem
          ? virtualOrRegularItem.item
          : listItems[virtualOrRegularItem.index];

      if (!item) return null;

      const itemStyle =
        virtualized && 'start' in virtualOrRegularItem
          ? {
              position: 'absolute' as const,
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualOrRegularItem.start}px)`,
            }
          : undefined;

      return item.type === 'section' ? (
        <ListBoxSection
          key={item.key}
          item={item}
          listState={listState}
          hiddenOptions={hiddenOptions}
          onToggle={onSectionToggle}
          size={size}
          showSectionHeaders={showSectionHeaders}
          showDetails={showDetails}
          style={itemStyle}
        />
      ) : (
        <ListBoxOption
          key={item.key}
          item={item}
          listState={listState}
          size={size}
          showDetails={showDetails}
          style={itemStyle}
        />
      );
    });
  };

  const content = (
    <ListWrap
      {...mergeProps(listBoxProps, props)}
      onKeyDown={onKeyDown}
      ref={mergeRefs(listElementRef, ref)}
      style={
        virtualized
          ? {
              height: virtualizer.getTotalSize(),
              position: 'relative',
              overflow: 'unset',
            }
          : undefined
      }
    >
      {overlayIsOpen && renderListItems()}

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

      {virtualized ? (
        <div
          ref={scrollElementRef}
          style={{
            overflow: 'auto',
            maxHeight: virtualizedMenuOptions.maxHeight,
            height: Math.min(
              virtualizedMenuOptions.maxHeight,
              virtualizer.getTotalSize()
            ),
            width: '100%',
            minWidth: virtualizedMenuOptions.minWidth,
          }}
        >
          {content}
        </div>
      ) : (
        content
      )}
    </Fragment>
  );
}
