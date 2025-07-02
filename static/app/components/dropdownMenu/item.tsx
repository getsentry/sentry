import {Fragment, useContext, useEffect, useRef} from 'react';
import {useHover, useKeyboard} from '@react-aria/interactions';
import {useMenuItem} from '@react-aria/menu';
import {mergeProps} from '@react-aria/utils';
import type {TreeState} from '@react-stately/tree';
import type {Node} from '@react-types/shared';
import type {LocationDescriptor} from 'history';

import {Link} from 'sentry/components/core/link';
import type {MenuListItemProps} from 'sentry/components/core/menuListItem';
import {MenuListItem} from 'sentry/components/core/menuListItem';
import ExternalLink from 'sentry/components/links/externalLink';
import {IconChevron} from 'sentry/icons';
import usePrevious from 'sentry/utils/usePrevious';

import {DropdownMenuContext} from './list';

export interface MenuItemProps extends MenuListItemProps {
  /**
   * Item key. Must be unique across the entire menu, including sub-menus.
   */
  key: string;
  /**
   * Sub-items that are nested inside this item. By default, sub-items are
   * rendered collectively as menu sections inside the current menu. If
   * `isSubmenu` is true, then they will be rendered together in a sub-menu.
   */
  children?: MenuItemProps[];
  /**
   * Pass a class name to the menu item.
   */
  className?: string;
  /**
   * Destination if this menu item is an external link.
   */
  externalHref?: string;
  /**
   * Hide item from the dropdown menu. Note: this will also remove the item
   * from the selection manager.
   */
  hidden?: boolean;
  /**
   * Whether this menu item is a trigger for a nested sub-menu. Only works
   * when `children` is also defined.
   */
  isSubmenu?: boolean;
  /**
   * Menu item label. Should preferably be a string. If not, provide a `textValue` prop
   * to enable search & keyboard select.
   */
  label?: MenuListItemProps['label'];
  /**
   * Function to call when user selects/clicks/taps on the menu item. The
   * item's key is passed as an argument.
   */
  onAction?: () => void;
  /**
   * Passed as the `menuTitle` prop onto the associated sub-menu (applicable
   * if `children` is defined and `isSubmenu` is true)
   */
  submenuTitle?: string;
  /**
   * A plain text version of the `label` prop if the label is not a string. Used for
   * filtering and keyboard select (quick-focusing on options by typing the first letter).
   */
  textValue?: string;
  /**
   * Destination if this menu item is a link.
   */
  to?: LocationDescriptor;
}

interface DropdownMenuItemProps {
  /**
   * Whether to close the menu when an item has been clicked/selected
   */
  closeOnSelect: boolean;
  /**
   * Node representation (from @react-aria) of the item
   */
  node: Node<MenuItemProps>;
  /**
   * Tree state (from @react-stately) inherited from parent menu
   */
  state: TreeState<MenuItemProps>;
  /**
   * Handler that is called when the menu should close after selecting an item
   */
  onClose?: () => void;
  ref?: React.Ref<HTMLLIElement>;
  /**
   * Tag name for item wrapper
   */
  renderAs?: React.ElementType;
}

/**
 * A menu item with a label, optional details, leading and trailing elements.
 * Can also be used as a trigger button for a submenu. See:
 * https://react-spectrum.adobe.com/react-aria/useMenu.html
 */
function DropdownMenuItem({
  node,
  state,
  closeOnSelect,
  onClose,
  renderAs = 'li',
  ref,
  ...props
}: DropdownMenuItemProps) {
  const innerWrapRef = useRef<HTMLDivElement | null>(null);
  const isDisabled = state.disabledKeys.has(node.key);
  const isFocused = state.selectionManager.focusedKey === node.key;
  const {key, onAction, to, label, isSubmenu, trailingItems, externalHref, ...itemProps} =
    node.value ?? {};
  const {size} = node.props;
  const {rootOverlayState} = useContext(DropdownMenuContext);
  const isLink = to || externalHref;

  const actionHandler = () => {
    if (isLink) {
      // Close the menu after the click event has bubbled to the link
      // Only needed on links that do not unmount the menu
      if (closeOnSelect) {
        requestAnimationFrame(() => rootOverlayState?.close());
      }
      return;
    }
    if (isSubmenu) {
      state.selectionManager.toggleSelection(node.key);
      return;
    }
    onAction?.();
  };

  // Open submenu on hover
  const {hoverProps, isHovered} = useHover({});
  const prevIsHovered = usePrevious(isHovered);
  const prevIsFocused = usePrevious(isFocused);
  useEffect(() => {
    if (isHovered === prevIsHovered && isFocused === prevIsFocused) {
      return;
    }

    if (isHovered && isFocused) {
      if (isSubmenu) {
        state.selectionManager.replaceSelection(node.key);
        return;
      }
      state.selectionManager.clearSelection();
    }
  }, [
    isHovered,
    isFocused,
    prevIsHovered,
    prevIsFocused,
    isSubmenu,
    node.key,
    state.selectionManager,
  ]);

  // Open submenu on arrow right key press
  const {keyboardProps} = useKeyboard({
    onKeyDown: e => {
      if (e.key === 'ArrowRight' && isSubmenu) {
        state.selectionManager.replaceSelection(node.key);
        return;
      }

      e.continuePropagation();
    },
  });

  // Manage interactive events & create aria attributes
  const {menuItemProps, labelProps, descriptionProps} = useMenuItem(
    {
      key: node.key,
      onAction: actionHandler,
      onClose: () => {
        onClose?.();
        rootOverlayState?.close();
      },
      closeOnSelect: isLink ? false : closeOnSelect,
      isDisabled,
    },
    state,
    innerWrapRef
  );

  const makeInnerWrapProps = () => {
    if (to) {
      return {
        as: Link,
        to,
      };
    }

    if (externalHref) {
      return {
        as: ExternalLink,
        href: externalHref,
      };
    }

    return {as: 'div' as const};
  };
  const mergedMenuItemContentProps = mergeProps(
    props,
    menuItemProps,
    hoverProps,
    keyboardProps,
    makeInnerWrapProps(),
    {ref: innerWrapRef, 'data-test-id': key}
  );
  const itemLabel = node.rendered ?? label;

  return (
    <MenuListItem
      ref={ref}
      as={renderAs}
      label={itemLabel}
      disabled={isDisabled}
      isFocused={isFocused}
      innerWrapProps={mergedMenuItemContentProps}
      labelProps={labelProps}
      detailsProps={descriptionProps}
      trailingItems={
        isSubmenu ? (
          <Fragment>
            {trailingItems as React.ReactNode}
            <IconChevron size="xs" direction="right" aria-hidden="true" />
          </Fragment>
        ) : (
          trailingItems
        )
      }
      size={size}
      {...itemProps}
    />
  );
}

export default DropdownMenuItem;
