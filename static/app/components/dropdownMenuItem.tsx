import {forwardRef, Fragment, useEffect, useRef, useState} from 'react';
import {useHover, useKeyboard} from '@react-aria/interactions';
import {useMenuItem} from '@react-aria/menu';
import {mergeProps} from '@react-aria/utils';
import {TreeState} from '@react-stately/tree';
import {Node} from '@react-types/shared';
import {LocationDescriptor} from 'history';

import Link from 'sentry/components/links/link';
import MenuListItem, {
  InnerWrap as MenuListItemInnerWrap,
  MenuListItemProps,
} from 'sentry/components/menuListItem';
import {IconChevron} from 'sentry/icons';
import mergeRefs from 'sentry/utils/mergeRefs';
import usePrevious from 'sentry/utils/usePrevious';

export type MenuItemProps = MenuListItemProps & {
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
   * Plass a class name to the menu item.
   */
  className?: string;
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
   * Function to call when user selects/clicks/taps on the menu item. The
   * item's key is passed as an argument.
   */
  onAction?: (key: MenuItemProps['key']) => void;
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
};

/**
 * A menu item with a label, optional details, leading and trailing elements.
 * Can also be used as a trigger button for a submenu. See:
 * https://react-spectrum.adobe.com/react-aria/useMenu.html
 */
const BaseDropdownMenuItem: React.ForwardRefRenderFunction<HTMLLIElement, Props> = (
  {
    node,
    isLastNode,
    state,
    onClose,
    closeOnSelect,
    isSubmenuTrigger = false,
    renderAs = 'li' as React.ElementType,
    ...submenuTriggerProps
  },
  forwardedRef
) => {
  const ref = useRef<HTMLLIElement | null>(null);
  const isDisabled = state.disabledKeys.has(node.key);
  const isFocused = state.selectionManager.focusedKey === node.key;
  const {key, onAction, to, label, showDividers, ...itemProps} = node.value;
  const {size} = node.props;

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
  const [isHovering, setIsHovering] = useState(false);
  const {hoverProps} = useHover({onHoverChange: setIsHovering});
  const prevIsHovering = usePrevious(isHovering);
  const prevIsFocused = usePrevious(isFocused);
  useEffect(() => {
    if (isHovering === prevIsHovering && isFocused === prevIsFocused) {
      return;
    }

    if (isHovering && isFocused) {
      if (isSubmenuTrigger) {
        state.selectionManager.select(node.key);
        return;
      }
      state.selectionManager.clearSelection();
    }
  }, [
    isHovering,
    isFocused,
    prevIsHovering,
    prevIsFocused,
    isSubmenuTrigger,
    node.key,
    state.selectionManager,
  ]);

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
      aria-haspopup={isSubmenuTrigger}
      ref={mergeRefs([ref, forwardedRef])}
      as={renderAs}
      data-test-id={key}
      label={itemLabel}
      disabled={isDisabled}
      isFocused={isFocused}
      showDivider={showDivider}
      innerWrapProps={innerWrapProps}
      labelProps={labelProps}
      detailsProps={descriptionProps}
      size={size}
      {...props}
      {...itemProps}
      {...(isSubmenuTrigger && {
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

const DropdownMenuItem = forwardRef(BaseDropdownMenuItem);

export default DropdownMenuItem;
