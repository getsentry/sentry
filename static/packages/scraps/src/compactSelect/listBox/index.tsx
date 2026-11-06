import type * as React from 'react';
import {Fragment, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import type {AriaListBoxOptions} from '@react-aria/listbox';
import {useListBox} from '@react-aria/listbox';
import {mergeProps, mergeRefs} from '@react-aria/utils';
import type {ListState} from '@react-stately/list';
import type {CollectionChildren} from '@react-types/shared';

import {
  ListLabel,
  ListSeparator,
  ListWrap,
  SizeLimitMessage,
} from '@sentry/scraps/compactSelect/styles';
import type {SelectKey, ListItemBase} from '@sentry/scraps/compactSelect/types';
import {hasVisibleLeadingItems} from '@sentry/scraps/compactSelect/utils';
import {Container} from '@sentry/scraps/layout';
import {ReserveLeadingSlot, type ListItemProps} from '@sentry/scraps/menu';
import type {FormSize} from '@sentry/scraps/theme';
import {useTranslation} from '@sentry/scraps/translation';
import {useVirtualCollection, VirtualSpacer} from '@sentry/scraps/useVirtualCollection';

import {ListBoxDetailsHoverContext, ListBoxOption} from './option';
import {ListBoxSection} from './section';

interface ListBoxProps<T extends ListItemBase>
  extends
    Omit<
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
      | 'isVirtualized'
    > {
  /**
   * Object containing the selection state and focus position, needed for
   * `useListBox()`.
   */
  listState: ListState<T>;
  children?: CollectionChildren<T>;
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
   * Keyboard event handler, to be attached to the list (`ul`) element, to seamlessly
   * move focus from one composite list to another when an arrow key is pressed. Returns
   * a boolean indicating whether the keyboard event was intercepted. If yes, then no
   * further callback function should be run.
   */
  keyDownHandler?: (e: React.KeyboardEvent<HTMLUListElement>) => boolean;
  /**
   * Text label to be rendered as heading on top of grid list.
   */
  label?: React.ReactNode;
  /**
   * Used to determine whether to render the list box items or not
   */
  overlayIsOpen?: boolean;
  ref?: React.Ref<HTMLUListElement>;
  /**
   * Ref forwarded to the inner scroll container div (the element the virtualizer
   * uses as its scroll element). Useful for callers that need to reset scrollTop.
   */
  scrollContainerRef?: React.Ref<HTMLDivElement>;
  /**
   * Whether the select has a search input field.
   */
  searchable?: boolean;
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
   * If true, virtualization will be enabled for the list
   */
  virtualized?: boolean;
  /**
   * Vertical padding (in px) of the list above its first item, used to align
   * virtualized rows. Defaults to 4 (theme.space.xs).
   */
  virtualizedListPadding?: number;
}

const EMPTY_SET = new Set<never>();
const DETAILS_CLOSE_DELAY = 150;
const DEFAULT_KEY_DOWN_HANDLER = () => true;

/**
 * A list box with accessibile behaviors & attributes.
 * https://react-spectrum.adobe.com/react-aria/useListBox.html
 *
 * Unlike grid lists, list boxes are one-dimensional. Users can press Arrow Up/Down to
 * move between options. All interactive elements (buttons/links) inside list box
 * options are unreachable via keyboard (only the options themselves can be focused on).
 * If interactive children are necessary, consider using grid lists instead (by setting
 * `mode="grid"` on CompactSelect).
 */
export function ListBox<T extends ListItemBase>({
  ref,
  listState,
  autoFocus,
  size = 'md',
  shouldFocusWrap = true,
  shouldFocusOnHover = true,
  sizeLimitMessage,
  keyDownHandler = DEFAULT_KEY_DOWN_HANDLER,
  label,
  hiddenOptions = EMPTY_SET,
  hasSearch,
  searchable,
  overlayIsOpen,
  showSectionHeaders = true,
  showDetails = true,
  onAction,
  virtualized,
  virtualizedListPadding,
  scrollContainerRef,
  className,
  ...props
}: ListBoxProps<T>) {
  const {t} = useTranslation();
  const listElementRef = useRef<HTMLUListElement>(null);
  const scrollElementRef = useRef<HTMLDivElement>(null);
  const [hasEverOverflowed, setHasEverOverflowed] = useState(false);

  const {listBoxProps, labelProps} = useListBox(
    {
      ...props,
      // useListBox forwards this to useSelectableCollection, but omits it from its
      // public options type. This identifies the element that actually owns overflow.
      // @ts-expect-error React Aria supports scrollRef at runtime but does not expose it here.
      scrollRef: scrollElementRef,
      autoFocus,
      label,
      shouldFocusWrap,
      shouldFocusOnHover,
      shouldSelectOnPressUp: true,
      onAction,
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
  const reserveLeadingSlot = useMemo(
    () => hasVisibleLeadingItems(listItems, hiddenOptions),
    [listItems, hiddenOptions]
  );

  const mergedProps = mergeProps(listBoxProps, props);

  const clearFocusTimeoutRef = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(clearFocusTimeoutRef.current), []);

  const cancelFocusClear = useCallback(() => {
    window.clearTimeout(clearFocusTimeoutRef.current);
  }, []);

  const scheduleFocusClear = useCallback(() => {
    window.clearTimeout(clearFocusTimeoutRef.current);
    clearFocusTimeoutRef.current = window.setTimeout(
      () => listState.selectionManager.setFocusedKey(null),
      DETAILS_CLOSE_DELAY
    );
  }, [listState.selectionManager]);

  const onDetailsHoverChange = useCallback(
    (isHovered: boolean, e: React.PointerEvent) => {
      if (isHovered) {
        cancelFocusClear();
      } else if (
        !(e.relatedTarget instanceof Node) ||
        !listElementRef.current?.contains(e.relatedTarget)
      ) {
        scheduleFocusClear();
      }
    },
    [cancelFocusClear, scheduleFocusClear]
  );

  const onMouseLeave = (e: React.MouseEvent<HTMLUListElement>) => {
    mergedProps.onMouseLeave?.(e);
    const {focusedKey} = listState.selectionManager;
    const focusedItemProps:
      | Pick<ListItemProps, 'details' | 'showDetailsInOverlay'>
      | undefined =
      focusedKey === null ? undefined : listState.collection.getItem(focusedKey)?.props;
    if (
      showDetails &&
      focusedItemProps?.showDetailsInOverlay &&
      focusedItemProps.details
    ) {
      scheduleFocusClear();
      return;
    }
    listState.selectionManager.setFocusedKey(null);
  };

  const onMouseEnter = (e: React.MouseEvent<HTMLUListElement>) => {
    mergedProps.onMouseEnter?.(e);
    cancelFocusClear();
  };

  const virtual = useVirtualCollection({
    nodes: listItems,
    enabled: !!virtualized,
    size,
    scrollRef: scrollElementRef,
    focusedKey: listState.selectionManager.focusedKey,
    listPadding: virtualizedListPadding ?? 4,
  });

  const refs = useMemo(() => {
    const overflowTracker = (scrollContainer: HTMLDivElement | null) => {
      if (hasEverOverflowed || listItems.length === 0 || !scrollContainer) {
        return;
      }

      setHasEverOverflowed(scrollContainer.scrollHeight > scrollContainer.clientHeight);
    };
    return mergeRefs(scrollElementRef, overflowTracker, scrollContainerRef);
    // listItems is a dependency so the tracker re-runs when the options change.
    // oxlint-disable-next-line react/memo-dependencies
  }, [hasEverOverflowed, listItems, scrollContainerRef]);

  return (
    <ListBoxDetailsHoverContext value={onDetailsHoverChange}>
      <ReserveLeadingSlot reserve={reserveLeadingSlot}>
        {listItems.length !== 0 && <ListSeparator role="separator" />}
        {listItems.length !== 0 && label && (
          <ListLabel {...labelProps}>{label}</ListLabel>
        )}
        <Container
          ref={refs}
          height="100%"
          overflowY="auto"
          className={className}
          style={hasEverOverflowed ? {scrollbarGutter: 'stable'} : undefined}
        >
          <ListWrap
            {...mergedProps}
            onKeyDown={onKeyDown}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            ref={mergeRefs(listElementRef, ref)}
          >
            {overlayIsOpen && (
              <Fragment>
                <VirtualSpacer height={virtual.spaceBefore} />
                {virtual.rows.map(({node, props: rowProps}) =>
                  node.type === 'section' ? (
                    <ListBoxSection
                      {...rowProps}
                      key={node.key}
                      item={node}
                      listState={listState}
                      hiddenOptions={hiddenOptions}
                      size={size}
                      showSectionHeaders={showSectionHeaders}
                      showDetails={showDetails}
                    />
                  ) : (
                    <ListBoxOption
                      {...rowProps}
                      key={node.key}
                      item={node}
                      listState={listState}
                      size={size}
                      showDetails={showDetails}
                    />
                  )
                )}
                <VirtualSpacer height={virtual.spaceAfter} />
              </Fragment>
            )}

            {!searchable && !hasSearch && hiddenOptions.size > 0 && (
              <SizeLimitMessage>
                {sizeLimitMessage ?? t('Use search to find more options…')}
              </SizeLimitMessage>
            )}
          </ListWrap>
        </Container>
      </ReserveLeadingSlot>
    </ListBoxDetailsHoverContext>
  );
}
