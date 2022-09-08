import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {useButton} from '@react-aria/button';
import {AriaMenuOptions, useMenuTrigger} from '@react-aria/menu';
import {AriaPositionProps, OverlayProps} from '@react-aria/overlays';
import {useResizeObserver} from '@react-aria/utils';
import {Item, Section} from '@react-stately/collections';
import {useMenuTriggerState} from '@react-stately/menu';
import {MenuTriggerProps} from '@react-types/menu';

import DropdownButton, {DropdownButtonProps} from 'sentry/components/dropdownButton';
import {MenuItemProps} from 'sentry/components/dropdownMenuItem';
import Menu from 'sentry/components/dropdownMenuV2';
import {FormSize} from 'sentry/utils/theme';

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

type TriggerProps = {
  props: Omit<React.HTMLAttributes<Element>, 'children'> & {
    onClick?: (e: MouseEvent) => void;
  };
  ref: React.RefObject<HTMLButtonElement>;
};

type Props = {
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
  trigger?: (props: TriggerProps) => React.ReactNode;
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
} & Partial<MenuTriggerProps> &
  Partial<AriaMenuOptions<MenuItemProps>> &
  Partial<OverlayProps> &
  Partial<AriaPositionProps>;

/**
 * A menu component that renders both the trigger button and the dropdown
 * menu. See: https://react-spectrum.adobe.com/react-aria/useMenuTrigger.html
 */
function MenuControl({
  items,
  disabledKeys,
  trigger,
  triggerLabel,
  triggerProps = {},
  isDisabled: disabledProp,
  isSubmenu = false,
  closeRootMenu,
  closeCurrentSubmenu,
  renderWrapAs = 'div',
  size = 'md',
  className,
  ...props
}: Props) {
  const ref = useRef<HTMLButtonElement>(null);
  const isDisabled = disabledProp ?? (!items || items.length === 0);

  // Control the menu open state. See:
  // https://react-spectrum.adobe.com/react-aria/useMenuTrigger.html
  const state = useMenuTriggerState(props);
  const {menuTriggerProps, menuProps} = useMenuTrigger(
    {type: 'menu', isDisabled},
    state,
    ref
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
    ref
  );

  // Calculate the current trigger element's width. This will be used as
  // the min width for the menu.
  const [triggerWidth, setTriggerWidth] = useState<number>();
  // Update triggerWidth when its size changes using useResizeObserver
  const updateTriggerWidth = useCallback(async () => {
    // Wait until the trigger element finishes rendering, otherwise
    // ResizeObserver might throw an infinite loop error.
    await new Promise(resolve => window.setTimeout(resolve));

    const newTriggerWidth = ref.current?.offsetWidth;
    !isSubmenu && newTriggerWidth && setTriggerWidth(newTriggerWidth);
  }, [isSubmenu]);

  useResizeObserver({ref, onResize: updateTriggerWidth});
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
        props: {
          size,
          isOpen: state.isOpen,
          ...triggerProps,
          ...buttonProps,
        },
        ref,
      });
    }
    return (
      <DropdownButton
        ref={ref}
        size={size}
        isOpen={state.isOpen}
        {...triggerProps}
        {...buttonProps}
      >
        {triggerLabel}
      </DropdownButton>
    );
  }

  const activeItems = useMemo(() => removeHiddenItems(items), [items]);
  const defaultDisabledKeys = useMemo(
    () => activeItems.filter(item => item.disabled).map(item => item.key),
    [activeItems]
  );

  function renderMenu() {
    if (!state.isOpen) {
      return null;
    }

    return (
      <Menu
        {...props}
        {...menuProps}
        triggerRef={ref}
        triggerWidth={triggerWidth}
        size={size}
        isSubmenu={isSubmenu}
        isDismissable={!isSubmenu && props.isDismissable}
        shouldCloseOnBlur={!isSubmenu && props.shouldCloseOnBlur}
        closeRootMenu={closeRootMenu ?? state.close}
        closeCurrentSubmenu={closeCurrentSubmenu}
        disabledKeys={disabledKeys ?? defaultDisabledKeys}
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
      </Menu>
    );
  }

  return (
    <MenuControlWrap className={className} as={renderWrapAs} role="presentation">
      {renderTrigger()}
      {renderMenu()}
    </MenuControlWrap>
  );
}

export default MenuControl;

const MenuControlWrap = styled('div')`
  list-style-type: none;
`;
