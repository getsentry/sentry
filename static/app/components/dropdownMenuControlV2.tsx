import {useRef} from 'react';
import styled from '@emotion/styled';
import {useButton} from '@react-aria/button';
import {AriaMenuOptions, useMenuTrigger} from '@react-aria/menu';
import {AriaPositionProps, OverlayProps} from '@react-aria/overlays';
import {Item, Section} from '@react-stately/collections';
import {useMenuTriggerState} from '@react-stately/menu';
import {MenuTriggerProps} from '@react-types/menu';

import DropdownButton, {DropdownButtonProps} from 'sentry/components/dropdownButtonV2';
import {MenuItemProps} from 'sentry/components/dropdownMenuItemV2';
import Menu from 'sentry/components/dropdownMenuV2';

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
  trigger,
  triggerLabel,
  triggerProps = {},
  isDisabled: disabledProp,
  isSubmenu = false,
  closeRootMenu,
  closeCurrentSubmenu,
  renderWrapAs = 'div',
  className,
  ...props
}: Props) {
  const ref = useRef(null);
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

  // Recursively remove hidden items, including those nested in submenus
  function removeHiddenItems(source) {
    return source
      .filter(item => !item.hidden)
      .map(item => ({
        ...item,
        ...(item.children ? {children: removeHiddenItems(item.children)} : {}),
      }));
  }

  function renderTrigger() {
    if (trigger) {
      return trigger({
        props: {
          ...triggerProps,
          ...buttonProps,
          isOpen: state.isOpen,
        },
        ref,
      });
    }
    return (
      <DropdownButton ref={ref} isOpen={state.isOpen} {...triggerProps} {...buttonProps}>
        {triggerLabel}
      </DropdownButton>
    );
  }

  function renderMenu() {
    if (!state.isOpen) {
      return null;
    }

    return (
      <Menu
        {...props}
        {...menuProps}
        triggerRef={ref}
        isSubmenu={isSubmenu}
        isDismissable={!isSubmenu && props.isDismissable}
        shouldCloseOnBlur={!isSubmenu && props.shouldCloseOnBlur}
        closeRootMenu={closeRootMenu ?? state.close}
        closeCurrentSubmenu={closeCurrentSubmenu}
        items={removeHiddenItems(items)}
      >
        {(item: MenuItemProps) => {
          if (item.children && item.children.length > 0 && !item.isSubmenu) {
            return (
              <Section key={item.key} title={item.label} items={item.children}>
                {sectionItem => <Item {...sectionItem}>{sectionItem.label}</Item>}
              </Section>
            );
          }
          return <Item {...item}>{item.label}</Item>;
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
