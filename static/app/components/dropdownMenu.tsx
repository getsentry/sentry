import {Fragment, useMemo, useRef} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {FocusScope} from '@react-aria/focus';
import {useKeyboard} from '@react-aria/interactions';
import {AriaMenuOptions, useMenu} from '@react-aria/menu';
import {AriaPositionProps, OverlayProps} from '@react-aria/overlays';
import {useSeparator} from '@react-aria/separator';
import {mergeProps} from '@react-aria/utils';
import {useTreeState} from '@react-stately/tree';
import {Node} from '@react-types/shared';

import MenuControl from 'sentry/components/dropdownMenuControl';
import MenuItem, {MenuItemProps} from 'sentry/components/dropdownMenuItem';
import MenuSection from 'sentry/components/dropdownMenuSection';
import {Overlay, PositionWrapper} from 'sentry/components/overlay';
import space from 'sentry/styles/space';

type Props = {
  /**
   * If this is a submenu, it will in some cases need to close the root menu
   * (e.g. when a submenu item is clicked).
   */
  closeRootMenu: () => void;
  /**
   * Whether this is a submenu
   */
  isSubmenu: boolean;
  overlayPositionProps: React.HTMLAttributes<HTMLDivElement>;
  /**
   * If this is a submenu, it will in some cases need to close itself (e.g.
   * when the user presses the arrow left key)
   */
  closeCurrentSubmenu?: () => void;
  /**
   * Whether the menu should close when an item has been clicked/selected
   */
  closeOnSelect?: boolean;
  /*
   * Title to display on top of the menu
   */
  menuTitle?: string;
  onClose?: () => void;
  size?: MenuItemProps['size'];
  /**
   * Current width of the trigger element. This is used as the menu's minimum
   * width.
   */
  triggerWidth?: number;
} & AriaMenuOptions<MenuItemProps> &
  Partial<OverlayProps> &
  Partial<AriaPositionProps>;

function DropdownMenu({
  closeOnSelect = true,
  triggerWidth,
  size,
  isSubmenu,
  menuTitle,
  closeRootMenu,
  closeCurrentSubmenu,
  overlayPositionProps,
  ...props
}: Props) {
  const state = useTreeState<MenuItemProps>({...props, selectionMode: 'single'});
  const stateCollection = useMemo(() => [...state.collection], [state.collection]);

  // Implement focus states, keyboard navigation, aria-label,...
  const menuRef = useRef(null);
  const {menuProps} = useMenu({...props, selectionMode: 'single'}, state, menuRef);
  const {separatorProps} = useSeparator({elementType: 'li'});

  // If this is a submenu, pressing arrow left should close it (but not the
  // root menu).
  const {keyboardProps} = useKeyboard({
    onKeyDown: e => {
      if (isSubmenu && e.key === 'ArrowLeft') {
        closeCurrentSubmenu?.();
        return;
      }
      e.continuePropagation();
    },
  });

  /**
   * Whether this menu/submenu is the current focused one, which in a nested,
   * tree-like menu system should be the leaf submenu. This information is
   * used for controlling keyboard events. See ``modifiedMenuProps` below.
   */
  const hasFocus = useMemo(() => {
    // A submenu is a leaf when it does not contain any expanded submenu. This
    // logically follows from the tree-like structure and single-selection
    // nature of menus.
    const isLeafSubmenu = !stateCollection.some(node => {
      const isSection = node.hasChildNodes && !node.value.isSubmenu;
      // A submenu with key [key] is expanded if
      // state.selectionManager.isSelected([key]) = true
      return isSection
        ? [...node.childNodes].some(child =>
            state.selectionManager.isSelected(`${child.key}`)
          )
        : state.selectionManager.isSelected(`${node.key}`);
    });

    return isLeafSubmenu;
  }, [stateCollection, state.selectionManager]);

  // Menu props from useMenu, modified to disable keyboard events if the
  // current menu does not have focus.
  const modifiedMenuProps = useMemo(
    () => ({
      ...menuProps,
      ...(!hasFocus && {
        onKeyUp: () => null,
        onKeyDown: () => null,
      }),
    }),
    [menuProps, hasFocus]
  );

  // Render a single menu item
  const renderItem = (node: Node<MenuItemProps>, isLastNode: boolean) => {
    return (
      <MenuItem
        node={node}
        isLastNode={isLastNode}
        state={state}
        onClose={closeRootMenu}
        closeOnSelect={closeOnSelect}
      />
    );
  };

  // Render a submenu whose trigger button is a menu item
  const renderItemWithSubmenu = (node: Node<MenuItemProps>, isLastNode: boolean) => {
    const trigger = submenuTriggerProps => (
      <MenuItem
        renderAs="div"
        node={node}
        isLastNode={isLastNode}
        state={state}
        isSubmenuTrigger
        {...submenuTriggerProps}
      />
    );

    return (
      <MenuControl
        items={node.value.children as MenuItemProps[]}
        trigger={trigger}
        menuTitle={node.value.submenuTitle}
        position="right-start"
        offset={-4}
        closeOnSelect={closeOnSelect}
        isOpen={state.selectionManager.isSelected(node.key)}
        size={size}
        isSubmenu
        closeRootMenu={closeRootMenu}
        closeCurrentSubmenu={() => state.selectionManager.clearSelection()}
        renderWrapAs="li"
      />
    );
  };

  // Render a collection of menu items
  const renderCollection = (collection: Node<MenuItemProps>[]) =>
    collection.map((node, i) => {
      const isLastNode = collection.length - 1 === i;
      const showSeparator =
        !isLastNode && (node.type === 'section' || collection[i + 1]?.type === 'section');

      let itemToRender: React.ReactNode;

      if (node.type === 'section') {
        itemToRender = (
          <MenuSection node={node}>{renderCollection([...node.childNodes])}</MenuSection>
        );
      } else {
        itemToRender = node.value.isSubmenu
          ? renderItemWithSubmenu(node, isLastNode)
          : renderItem(node, isLastNode);
      }

      return (
        <Fragment key={node.key}>
          {itemToRender}
          {showSeparator && <Separator {...separatorProps} />}
        </Fragment>
      );
    });

  const theme = useTheme();
  return (
    <FocusScope restoreFocus autoFocus>
      <PositionWrapper zIndex={theme.zIndex.dropdown} {...overlayPositionProps}>
        <StyledOverlay>
          <MenuWrap
            ref={menuRef}
            {...mergeProps(modifiedMenuProps, keyboardProps)}
            style={{
              maxHeight: overlayPositionProps.style?.maxHeight,
              minWidth: triggerWidth,
            }}
          >
            {menuTitle && <MenuTitle>{menuTitle}</MenuTitle>}
            {renderCollection(stateCollection)}
          </MenuWrap>
        </StyledOverlay>
      </PositionWrapper>
    </FocusScope>
  );
}

export default DropdownMenu;

const StyledOverlay = styled(Overlay)`
  max-width: 24rem;
  @media only screen and (max-width: calc(24rem + ${space(2)} * 2)) {
    max-width: calc(100vw - ${space(2)} * 2);
  }
`;

const MenuWrap = styled('ul')`
  margin: 0;
  padding: ${space(0.5)} 0;
  font-size: ${p => p.theme.fontSizeMedium};

  &:focus {
    outline: none;
  }
`;

const MenuTitle = styled('div')`
  font-weight: 600;
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.headingColor};
  white-space: nowrap;
  padding: ${space(0.25)} ${space(1.5)} ${space(0.75)};
  margin-bottom: ${space(0.5)};
  border-bottom: solid 1px ${p => p.theme.innerBorder};
`;

const Separator = styled('li')`
  list-style-type: none;
  border-top: solid 1px ${p => p.theme.innerBorder};
  margin: ${space(0.5)} ${space(1.5)};
`;
