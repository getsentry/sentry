import {useContext, useMemo} from 'react';
import {createPortal} from 'react-dom';
import styled from '@emotion/styled';
import {useButton} from '@react-aria/button';
import {useMenuTrigger} from '@react-aria/menu';
import {Item, Section} from '@react-stately/collections';

import type {DropdownButtonProps} from 'sentry/components/dropdownButton';
import DropdownButton from 'sentry/components/dropdownButton';
import type {FormSize} from 'sentry/utils/theme';
import type {UseOverlayProps} from 'sentry/utils/useOverlay';
import useOverlay from 'sentry/utils/useOverlay';

import type {MenuItemProps} from './item';
import type {DropdownMenuListProps} from './list';
import DropdownMenuList, {DropdownMenuContext} from './list';

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

export interface DropdownMenuProps
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
      | 'onOpenChange'
      | 'preventOverflowOptions'
      | 'flipOptions'
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
  menuTitle?: React.ReactChild;
  /**
   * Reference to the container element that the portal should be rendered into.
   */
  portalContainerRef?: React.RefObject<HTMLElement>;
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
    props: Omit<React.HTMLAttributes<HTMLElement>, 'children'>,
    isOpen: boolean
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

  /**
   * Whether to render the menu inside a React portal (false by default). This should
   * only be enabled if necessary, e.g. when the dropdown menu is inside a small,
   * scrollable container that messes with the menu's position. Some features, namely
   * submenus, will not work correctly inside portals.
   */
  usePortal?: boolean;
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
  renderWrapAs = 'div',
  size = 'md',
  className,

  // Overlay props
  usePortal = false,
  offset = 8,
  position = 'bottom-start',
  isDismissable = true,
  shouldCloseOnBlur = true,
  shouldCloseOnInteractOutside,
  onInteractOutside,
  onOpenChange,
  preventOverflowOptions,
  flipOptions,
  portalContainerRef,
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
    disableTrigger: isDisabled,
    shouldCloseOnBlur,
    shouldCloseOnInteractOutside,
    onInteractOutside,
    preventOverflowOptions,
    flipOptions,
    onOpenChange,
  });

  const {menuTriggerProps, menuProps} = useMenuTrigger(
    {type: 'menu', isDisabled},
    {...overlayState, focusStrategy: 'first'},
    triggerRef
  );
  // We manually handle focus in the dropdown menu, so we don't want the default autofocus behavior
  // Avoids the menu from focusing before popper has placed it in the correct position
  menuProps.autoFocus = false;

  const {buttonProps} = useButton(
    {
      isDisabled,
      ...menuTriggerProps,
    },
    triggerRef
  );

  function renderTrigger() {
    if (trigger) {
      return trigger({...buttonProps, ...overlayTriggerProps}, isOpen);
    }
    return (
      <DropdownButton
        size={size}
        isOpen={isOpen}
        {...buttonProps}
        {...overlayTriggerProps}
        {...triggerProps}
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

    const menu = (
      <DropdownMenuList
        {...props}
        {...menuProps}
        size={size}
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
            <Item size={size} {...item} key={item.key}>
              {item.label}
            </Item>
          );
        }}
      </DropdownMenuList>
    );

    return usePortal
      ? createPortal(menu, portalContainerRef?.current ?? document.body)
      : menu;
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
  display: contents;
  list-style-type: none;
`;
