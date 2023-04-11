import {useCallback, useContext, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import {useButton} from '@react-aria/button';
import {useMenuTrigger} from '@react-aria/menu';
import {useResizeObserver} from '@react-aria/utils';
import {Item, Section} from '@react-stately/collections';

import DropdownButton, {DropdownButtonProps} from 'sentry/components/dropdownButton';
import {FormSize} from 'sentry/utils/theme';
import useOverlay, {UseOverlayProps} from 'sentry/utils/useOverlay';

import type {MenuItemProps} from './item';
import DropdownMenuList, {DropdownMenuContext, DropdownMenuListProps} from './list';

export type {MenuItemProps};

/**
 * Recursively removes hidden items, including those nested in submenus
 */
function removeHiddenItems(source: MenuItemProps[]): MenuItemProps[] {
  return source
    .filter(item => !item.hidden)
    .map(item => ({
      ...item,
      ...(item.children ? {children: removeHiddenItems(item.children)} : {}),
    }));
}

/**
 * Recursively finds and returns disabled items
 */
function getDisabledKeys(source: MenuItemProps[]): MenuItemProps['key'][] {
  return source.reduce<string[]>((acc, cur) => {
    if (cur.disabled) {
      // If an item is disabled, then its children will be inaccessible, so we
      // can skip them and just return the parent item
      return acc.concat([cur.key]);
    }

    if (cur.children) {
      return acc.concat(getDisabledKeys(cur.children));
    }

    return acc;
  }, []);
}

interface DropdownMenuProps
  extends Omit<
      DropdownMenuListProps,
      'overlayState' | 'overlayPositionProps' | 'items' | 'children' | 'menuTitle'
    >,
    Pick<
      UseOverlayProps,
      | 'isOpen'
      | 'offset'
      | 'position'
      | 'isDismissable'
      | 'shouldCloseOnBlur'
      | 'shouldCloseOnInteractOutside'
      | 'onInteractOutside'
      | 'preventOverflowOptions'
    > {
  /**
   * Items to display inside the dropdown menu. If the item has a `children`
   * prop, it will be rendered as a menu section. If it has a `children` prop
   * and its `isSubmenu` prop is true, it will be rendered as a submenu.
   */
  items: MenuItemProps[];
  /**
   * Pass class name to the outer wrap
   */
  className?: string;
  /**
   * Whether the trigger is disabled.
   */
  isDisabled?: boolean;
  /**
   * Title for the current menu.
   */
  menuTitle?: string;
  /**
   * Whether the menu should always be wider than the trigger. If true (default), then
   * the menu will have a min width equal to the trigger's width.
   */
  menuWiderThanTrigger?: boolean;
  /**
   * Minimum menu width, in pixels
   */
  minMenuWidth?: number;
  /**
   * Tag name for the outer wrap, defaults to `div`
   */
  renderWrapAs?: React.ElementType;
  /**
   * Affects the size of the trigger button and menu items.
   */
  size?: FormSize;
  /**
   * Optionally replace the trigger button with a different component. Note
   * that the replacement must have the `props` and `ref` (supplied in
   * TriggerProps) forwarded its outer wrap, otherwise the accessibility
   * features won't work correctly.
   */
  trigger?: (
    props: Omit<React.HTMLAttributes<Element>, 'children'> & {
      onClick?: (e: MouseEvent) => void;
    }
  ) => React.ReactNode;
  /**
   * By default, the menu trigger will be rendered as a button, with
   * triggerLabel as the button label.
   */
  triggerLabel?: React.ReactNode;
  /**
   * If using the default button trigger (i.e. the custom `trigger` prop has
   * not been provided), then `triggerProps` will be passed on to the button
   * component.
   */
  triggerProps?: DropdownButtonProps;
}

/**
 * A menu component that renders both the trigger button and the dropdown
 * menu. See: https://react-spectrum.adobe.com/react-aria/useMenuTrigger.html
 */
function DropdownMenu({
  items,
  disabledKeys,
  trigger,
  triggerLabel,
  triggerProps = {},
  isDisabled: disabledProp,
  isOpen: isOpenProp,
  minMenuWidth,
  menuWiderThanTrigger = true,
  renderWrapAs = 'div',
  size = 'md',
  className,

  // Overlay props
  offset = 8,
  position = 'bottom-start',
  isDismissable = true,
  shouldCloseOnBlur = true,
  shouldCloseOnInteractOutside,
  onInteractOutside,
  preventOverflowOptions,
  ...props
}: DropdownMenuProps) {
  const isDisabled = disabledProp ?? (!items || items.length === 0);

  const {rootOverlayState} = useContext(DropdownMenuContext);
  const {
    isOpen,
    state: overlayState,
    triggerRef,
    triggerProps: overlayTriggerProps,
    overlayProps,
  } = useOverlay({
    isOpen: isOpenProp,
    onClose: rootOverlayState?.close,
    offset,
    position,
    isDismissable,
    shouldCloseOnBlur,
    shouldCloseOnInteractOutside,
    onInteractOutside,
    preventOverflowOptions,
  });

  const {menuTriggerProps, menuProps} = useMenuTrigger(
    {type: 'menu', isDisabled},
    {...overlayState, focusStrategy: 'first'},
    triggerRef
  );

  const {buttonProps} = useButton(
    {
      isDisabled,
      ...menuTriggerProps,
    },
    triggerRef
  );

  // Calculate the current trigger element's width. This will be used as
  // the min width for the menu.
  const [triggerWidth, setTriggerWidth] = useState<number>();
  // Update triggerWidth when its size changes using useResizeObserver
  const updateTriggerWidth = useCallback(async () => {
    if (!menuWiderThanTrigger) {
      return;
    }

    // Wait until the trigger element finishes rendering, otherwise
    // ResizeObserver might throw an infinite loop error.
    await new Promise(resolve => window.setTimeout(resolve));
    setTriggerWidth(triggerRef.current?.offsetWidth ?? 0);
  }, [menuWiderThanTrigger, triggerRef]);

  useResizeObserver({ref: triggerRef, onResize: updateTriggerWidth});
  // If ResizeObserver is not available, manually update the width
  // when any of [trigger, triggerLabel, triggerProps] changes.
  useEffect(() => {
    if (typeof window.ResizeObserver !== 'undefined') {
      return;
    }
    updateTriggerWidth();
  }, [updateTriggerWidth]);

  function renderTrigger() {
    if (trigger) {
      return trigger({
        size,
        isOpen,
        ...triggerProps,
        ...overlayTriggerProps,
        ...buttonProps,
      });
    }
    return (
      <DropdownButton
        size={size}
        isOpen={isOpen}
        {...triggerProps}
        {...overlayTriggerProps}
        {...buttonProps}
      >
        {triggerLabel}
      </DropdownButton>
    );
  }

  const activeItems = useMemo(() => removeHiddenItems(items), [items]);
  const defaultDisabledKeys = useMemo(() => getDisabledKeys(activeItems), [activeItems]);

  function renderMenu() {
    if (!isOpen) {
      return null;
    }

    return (
      <DropdownMenuList
        {...props}
        {...menuProps}
        size={size}
        minWidth={Math.max(minMenuWidth ?? 0, triggerWidth ?? 0)}
        disabledKeys={disabledKeys ?? defaultDisabledKeys}
        overlayPositionProps={overlayProps}
        overlayState={overlayState}
        items={activeItems}
      >
        {(item: MenuItemProps) => {
          if (item.children && item.children.length > 0 && !item.isSubmenu) {
            return (
              <Section key={item.key} title={item.label} items={item.children}>
                {sectionItem => (
                  <Item size={size} {...sectionItem}>
                    {sectionItem.label}
                  </Item>
                )}
              </Section>
            );
          }
          return (
            <Item size={size} {...item}>
              {item.label}
            </Item>
          );
        }}
      </DropdownMenuList>
    );
  }

  return (
    <DropdownMenuWrap className={className} as={renderWrapAs} role="presentation">
      {renderTrigger()}
      {renderMenu()}
    </DropdownMenuWrap>
  );
}

export {DropdownMenu};

const DropdownMenuWrap = styled('div')`
  list-style-type: none;
`;
