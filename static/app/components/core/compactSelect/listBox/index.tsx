import {Fragment, useMemo, useRef} from 'react';
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

// Threshold for enabling virtualization - only virtualize if more than this many items
const VIRTUALIZATION_THRESHOLD = 100;
// Estimated height for each list item - will be measured dynamically
const ESTIMATED_ITEM_HEIGHT = 32;

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
   * Custom threshold for enabling virtualization. Defaults to 100 items.
   */
  virtualizationThreshold?: number;
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
  virtualizationThreshold = VIRTUALIZATION_THRESHOLD,
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

  // Determine if virtualization should be enabled based on item count
  const shouldVirtualize = listItems.length > virtualizationThreshold;

  // Set up virtualizer for large lists
  const virtualizer = useVirtualizer({
    count: listItems.length,
    getScrollElement: () => listElementRef.current,
    estimateSize: () => ESTIMATED_ITEM_HEIGHT,
    overscan: 5,
    enabled: shouldVirtualize,
  });

  const virtualItems = shouldVirtualize ? virtualizer.getVirtualItems() : [];

  // Render non-virtualized list for smaller item counts
  if (!shouldVirtualize) {
    return (
      <Fragment>
        {listItems.length !== 0 && <ListSeparator role="separator" />}
        {listItems.length !== 0 && label && <ListLabel {...labelProps}>{label}</ListLabel>}
        <ListWrap
          {...mergeProps(listBoxProps, props)}
          onKeyDown={onKeyDown}
          ref={mergeRefs(listElementRef, ref)}
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
  }

  // Render virtualized list for large item counts
  return (
    <Fragment>
      {listItems.length !== 0 && <ListSeparator role="separator" />}
      {listItems.length !== 0 && label && <ListLabel {...labelProps}>{label}</ListLabel>}
      <ListWrap
        {...mergeProps(listBoxProps, props)}
        onKeyDown={onKeyDown}
        ref={mergeRefs(listElementRef, ref)}
        style={{
          height: '300px', // Fixed height for virtualized list
          overflow: 'auto',
          ...props.style,
        }}
      >
        {overlayIsOpen && (
          <div
            style={{
              height: virtualizer.getTotalSize(),
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualItems.map(virtualItem => {
              const item = listItems[virtualItem.index];
              if (!item) {
                return null;
              }

              return (
                <div
                  key={virtualItem.key}
                  data-index={virtualItem.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  {item.type === 'section' ? (
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
                  ) : (
                    <ListBoxOption
                      key={item.key}
                      item={item}
                      listState={listState}
                      size={size}
                      showDetails={showDetails}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!hasSearch && hiddenOptions.size > 0 && (
          <SizeLimitMessage>
            {sizeLimitMessage ?? t('Use search to find more options…')}
          </SizeLimitMessage>
        )}
      </ListWrap>
    </Fragment>
  );
}
