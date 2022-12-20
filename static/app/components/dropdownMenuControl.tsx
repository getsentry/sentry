import {useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import {useButton} from '@react-aria/button';
import {AriaMenuOptions, useMenuTrigger} from '@react-aria/menu';
import {useResizeObserver} from '@react-aria/utils';
import {Item, Section} from '@react-stately/collections';
import {MenuTriggerProps} from '@react-types/menu';

import DropdownButton, {DropdownButtonProps} from 'sentry/components/dropdownButton';
import DropdownMenu from 'sentry/components/dropdownMenu';
import {MenuItemProps} from 'sentry/components/dropdownMenuItem';
import {FormSize} from 'sentry/utils/theme';
import useOverlay, {UseOverlayProps} from 'sentry/utils/useOverlay';

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

interface Props
  extends Partial<MenuTriggerProps>,
    Partial<AriaMenuOptions<MenuItemProps>>,
    UseOverlayProps {
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
   * If this is a submenu, it will in some cases need to close itself (e.g.
   * when the user presses the arrow left key)
   */
  closeCurrentSubmenu?: () => void;
  /**
   * If this is a submenu, it will in some cases need to close the root menu
   * (e.g. when a submenu item is clicked).
   */
  closeRootMenu?: () => void;
  /**
   * Whether the trigger is disabled.
   */
  isDisabled?: boolean;
  /**
   * Whether this is a submenu.
   */
  isSubmenu?: boolean;
  /**
   * Title for the current menu.
   */
  menuTitle?: string;
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
function DropdownMenuControl({
  items,
  disabledKeys,
  trigger,
  triggerLabel,
  triggerProps = {},
  isDisabled: disabledProp,
  isOpen: isOpenProp,
  minMenuWidth,
  isSubmenu = false,
  closeRootMenu,
  closeCurrentSubmenu,
  renderWrapAs = 'div',
  size = 'md',
  className,

  // Overlay props
  offset = 8,
  position = 'bottom-start',
  isDismissable = true,
  shouldCloseOnBlur = true,
  ...props
}: Props) {
  const isDisabled = disabledProp ?? (!items || items.length === 0);

  const {
    isOpen,
    state,
    triggerRef,
    triggerProps: overlayTriggerProps,
    overlayProps,
  } = useOverlay({
    onClose: closeRootMenu,
    isOpen: isOpenProp,
    offset,
    position,
    isDismissable: !isSubmenu && isDismissable,
    shouldCloseOnBlur: !isSubmenu && shouldCloseOnBlur,
    shouldCloseOnInteractOutside: target =>
      !isSubmenu &&
      target &&
      triggerRef.current !== target &&
      !triggerRef.current?.contains(target),
    // Necessary for submenus to be correctly positioned
    ...(isSubmenu && {preventOverflowOptions: {boundary: document.body}}),
  });

  const {menuTriggerProps, menuProps} = useMenuTrigger(
    {type: 'menu', isDisabled},
    {...state, focusStrategy: 'first'},
    triggerRef
  );

  const {buttonProps} = useButton(
    {
      isDisabled,
      ...menuTriggerProps,
      ...(isSubmenu && {
        onKeyUp: e => e.continuePropagation(),
        onKeyDown: e => e.continuePropagation(),
        onPress: () => null,
        onPressStart: () => null,
        onPressEnd: () => null,
      }),
    },
    triggerRef
  );

  // Calculate the current trigger element's width. This will be used as
  // the min width for the menu.
  const [triggerWidth, setTriggerWidth] = useState<number>();
  // Update triggerWidth when its size changes using useResizeObserver
  const updateTriggerWidth = useCallback(async () => {
    // Wait until the trigger element finishes rendering, otherwise
    // ResizeObserver might throw an infinite loop error.
    await new Promise(resolve => window.setTimeout(resolve));

    const newTriggerWidth = triggerRef.current?.offsetWidth;
    !isSubmenu && newTriggerWidth && setTriggerWidth(newTriggerWidth);
  }, [isSubmenu, triggerRef]);

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
      <DropdownMenu
        {...props}
        {...menuProps}
        size={size}
        isSubmenu={isSubmenu}
        minWidth={Math.max(minMenuWidth ?? 0, triggerWidth ?? 0)}
        closeRootMenu={closeRootMenu ?? state.close}
        closeCurrentSubmenu={closeCurrentSubmenu}
        disabledKeys={disabledKeys ?? defaultDisabledKeys}
        overlayPositionProps={overlayProps}
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
      </DropdownMenu>
    );
  }

  return (
    <MenuControlWrap className={className} as={renderWrapAs} role="presentation">
      {renderTrigger()}
      {renderMenu()}
    </MenuControlWrap>
  );
}

export default DropdownMenuControl;

const MenuControlWrap = styled('div')`
  list-style-type: none;
`;
