import {Fragment, useEffect, useRef, useState} from 'react';
import {useHover, useKeyboard} from '@react-aria/interactions';
import {useMenuItem} from '@react-aria/menu';
import {mergeProps} from '@react-aria/utils';
import {TreeState} from '@react-stately/tree';
import {Node} from '@react-types/shared';
import {LocationDescriptor} from 'history';

import Link from 'sentry/components/links/link';
import MenuListItem, {
  InnerWrap as MenuListItemInnerWrap,
} from 'sentry/components/menuListItem';
import {IconChevron} from 'sentry/icons';

/**
 * Menu item priority. Currently there's only one option other than default,
 * but we may choose to add more in the future.
 */
type Priority = 'danger' | 'default';

export type MenuItemProps = {
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
   * Optional descriptive text. Like 'label', should preferably be a string or
   * have appropriate aria-labels.
   */
  details?: React.ReactNode;
  /**
   * Hide item from the dropdown menu. Note: this will also remove the item
   * from the selection manager.
   */
  hidden?: boolean;
  /*
   * Whether this menu item is a trigger for a nested sub-menu. Only works
   * when `children` is also defined.
   */
  isSubmenu?: boolean;
  /**
   * Item label. Should prefereably be a string. If not, make sure that
   * there are appropriate aria-labels.
   */
  label?: React.ReactNode;
  /*
   * Items to be added to the left of the label
   */
  leadingItems?: React.ReactNode;
  /*
   * Whether leading items should be centered with respect to the entire
   * height of the menu item. If false (default), they will be centered with
   * respect to the first line of the label element.
   */
  leadingItemsSpanFullHeight?: boolean;
  /**
   * Function to call when user selects/clicks/taps on the menu item. The
   * item's key is passed as an argument.
   */
  onAction?: (key: MenuItemProps['key']) => void;
  /**
   * Accented text and background (on hover) colors.
   */
  priority?: Priority;
  /**
   * Whether to show a line divider below this menu item
   */
  showDividers?: boolean;
  /**
   * Passed as the `menuTitle` prop onto the associated sub-menu (applicable
   * if `children` is defined and `isSubmenu` is true)
   */
  submenuTitle?: string;
  /**
   * Destination if this menu item is a link. See also: `isExternalLink`.
   */
  to?: LocationDescriptor;
  /*
   * Items to be added to the right of the label.
   */
  trailingItems?: React.ReactNode;
  /*
   * Whether trailing items should be centered wrt/ the entire height of the
   * menu item. If false (default), they will be centered wrt/ the first line of the
   * label element.
   */
  trailingItemsSpanFullHeight?: boolean;
};

type Props = {
  /**
   * Whether to close the menu when an item has been clicked/selected
   */
  closeOnSelect: boolean;
  /**
   * Whether this is the last node in the collection
   */
  isLastNode: boolean;
  /**
   * Node representation (from @react-aria) of the item
   */
  node: Node<MenuItemProps>;
  /**
   * Used to close the menu when needed (e.g. when the item is
   * clicked/selected)
   */
  onClose: () => void;
  /**
   * Tree state (from @react-stately) inherited from parent menu
   */
  state: TreeState<MenuItemProps>;
  /**
   * Whether this is a trigger button (displayed as a normal menu item) for a
   * submenu
   */
  isSubmenuTrigger?: boolean;
  /**
   * Tag name for item wrapper
   */
  renderAs?: React.ElementType;
  /**
   * If isSubmenuTrigger is true, then replace the internal ref object with
   * this ref
   */
  submenuTriggerRef?: React.RefObject<HTMLLIElement>;
};

/**
 * A menu item with a label, optional details, leading and trailing elements.
 * Can also be used as a trigger button for a submenu. See:
 * https://react-spectrum.adobe.com/react-aria/useMenu.html
 */
const MenuItem = ({
  node,
  isLastNode,
  state,
  onClose,
  closeOnSelect,
  isSubmenuTrigger = false,
  submenuTriggerRef,
  renderAs = 'li' as React.ElementType,
  ...submenuTriggerProps
}: Props) => {
  const [isHovering, setIsHovering] = useState(false);
  const ourRef = useRef(null);
  const isDisabled = state.disabledKeys.has(node.key);
  const isFocused = state.selectionManager.focusedKey === node.key;
  const {key, onAction, to, label, showDividers, ...itemProps} = node.value;

  const ref = submenuTriggerRef ?? ourRef;

  const actionHandler = () => {
    if (to) {
      return;
    }
    if (isSubmenuTrigger) {
      state.selectionManager.select(node.key);
      return;
    }
    onAction?.(key);
  };

  // Open submenu on hover
  const {hoverProps} = useHover({onHoverChange: setIsHovering});
  useEffect(() => {
    if (isHovering && isFocused) {
      if (isSubmenuTrigger) {
        state.selectionManager.select(node.key);
        return;
      }
      state.selectionManager.clearSelection();
    }
  }, [isHovering, isFocused]);

  // Open submenu on arrow right key press
  const {keyboardProps} = useKeyboard({
    onKeyDown: e => {
      if (e.key === 'Enter' && to) {
        const mouseEvent = new MouseEvent('click', {
          ctrlKey: e.ctrlKey,
          metaKey: e.metaKey,
        });
        ref.current?.querySelector(`${MenuListItemInnerWrap}`)?.dispatchEvent(mouseEvent);
        onClose();
        return;
      }

      if (e.key === 'ArrowRight' && isSubmenuTrigger) {
        state.selectionManager.select(node.key);
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
      closeOnSelect: to ? false : closeOnSelect,
      onClose,
      isDisabled,
    },
    state,
    ref
  );

  // Merged menu item props, class names are combined, event handlers chained,
  // etc. See: https://react-spectrum.adobe.com/react-aria/mergeProps.html
  const props = mergeProps(submenuTriggerProps, menuItemProps, hoverProps, keyboardProps);
  const itemLabel = node.rendered ?? label;
  const showDivider = showDividers && !isLastNode;
  const innerWrapProps = {as: to ? Link : 'div', to};

  return (
    <MenuListItem
      ref={ref}
      as={renderAs}
      data-test-id={key}
      label={itemLabel}
      isDisabled={isDisabled}
      isFocused={isFocused}
      showDivider={showDivider}
      innerWrapProps={innerWrapProps}
      labelProps={labelProps}
      detailsProps={descriptionProps}
      {...props}
      {...itemProps}
      {...(isSubmenuTrigger && {
        role: 'menuitemradio',
        trailingItems: (
          <Fragment>
            {itemProps.trailingItems}
            <IconChevron size="xs" direction="right" aria-hidden="true" />
          </Fragment>
        ),
      })}
    />
  );
};

export default MenuItem;
