import {forwardRef, Fragment, useContext, useEffect, useRef} from 'react';
import {useHover, useKeyboard} from '@react-aria/interactions';
import {useMenuItem} from '@react-aria/menu';
import {mergeProps} from '@react-aria/utils';
import type {TreeState} from '@react-stately/tree';
import type {Node} from '@react-types/shared';
import type {LocationDescriptor} from 'history';

import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import type {MenuListItemProps} from 'sentry/components/menuListItem';
import MenuListItem, {
  InnerWrap as MenuListItemInnerWrap,
} from 'sentry/components/menuListItem';
import {IconChevron} from 'sentry/icons';
import mergeRefs from 'sentry/utils/mergeRefs';
import {useNavigate} from 'sentry/utils/useNavigate';
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
  /**
   * Tag name for item wrapper
   */
  renderAs?: React.ElementType;
  /**
   * Whether to show a divider below this item
   */
  showDivider?: boolean;
}

/**
 * A menu item with a label, optional details, leading and trailing elements.
 * Can also be used as a trigger button for a submenu. See:
 * https://react-spectrum.adobe.com/react-aria/useMenu.html
 */
function BaseDropdownMenuItem(
  {
    node,
    state,
    closeOnSelect,
    onClose,
    showDivider,
    renderAs = 'li',
    ...props
  }: DropdownMenuItemProps,
  forwardedRef: React.Ref<HTMLLIElement>
) {
  const ref = useRef<HTMLLIElement | null>(null);
  const isDisabled = state.disabledKeys.has(node.key);
  const isFocused = state.selectionManager.focusedKey === node.key;
  const {key, onAction, to, label, isSubmenu, trailingItems, externalHref, ...itemProps} =
    node.value ?? {};
  const {size} = node.props;
  const {rootOverlayState} = useContext(DropdownMenuContext);
  const navigate = useNavigate();

  const actionHandler = () => {
    if (to || externalHref) {
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
      if (e.key === 'Enter' && (to || externalHref)) {
        // If the user is holding down the meta key, we want to dispatch a mouse event
        if (e.metaKey || e.ctrlKey || externalHref) {
          const mouseEvent = new MouseEvent('click', {
            ctrlKey: e.ctrlKey,
            metaKey: e.metaKey,
          });
          ref.current
            ?.querySelector(`${MenuListItemInnerWrap}`)
            ?.dispatchEvent(mouseEvent);
          return;
        }

        if (to) {
          navigate(to);
        }
        return;
      }

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
      closeOnSelect: to || externalHref ? false : closeOnSelect,
      isDisabled,
    },
    state,
    ref
  );

  // Merged menu item props, class names are combined, event handlers chained,
  // etc. See: https://react-spectrum.adobe.com/react-aria/mergeProps.html
  const mergedProps = mergeProps(props, menuItemProps, hoverProps, keyboardProps);
  const itemLabel = node.rendered ?? label;
  const makeInnerWrapProps = () => {
    if (to) {
      return {as: Link, to};
    }

    if (externalHref) {
      return {as: ExternalLink, href: externalHref};
    }

    return {as: 'div' as const};
  };

  return (
    <MenuListItem
      ref={mergeRefs([ref, forwardedRef])}
      as={renderAs}
      data-test-id={key}
      label={itemLabel}
      disabled={isDisabled}
      isFocused={isFocused}
      showDivider={showDivider}
      innerWrapProps={makeInnerWrapProps()}
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
      {...mergedProps}
      {...itemProps}
    />
  );
}

const DropdownMenuItem = forwardRef(BaseDropdownMenuItem);

export default DropdownMenuItem;
