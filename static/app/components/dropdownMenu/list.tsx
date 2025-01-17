import {createContext, Fragment, useContext, useMemo, useRef} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {FocusScope} from '@react-aria/focus';
import {useKeyboard} from '@react-aria/interactions';
import type {AriaMenuOptions} from '@react-aria/menu';
import {useMenu} from '@react-aria/menu';
import {useSeparator} from '@react-aria/separator';
import {mergeProps} from '@react-aria/utils';
import type {TreeProps, TreeState} from '@react-stately/tree';
import {useTreeState} from '@react-stately/tree';
import type {Node} from '@react-types/shared';
import omit from 'lodash/omit';

import {Overlay, PositionWrapper} from 'sentry/components/overlay';
import {space} from 'sentry/styles/space';
import type useOverlay from 'sentry/utils/useOverlay';

import {DropdownMenu} from './index';
import type {MenuItemProps} from './item';
import DropdownMenuItem from './item';
import DropdownMenuSection from './section';

type OverlayState = ReturnType<typeof useOverlay>['state'];

interface DropdownMenuContextValue {
  /**
   * Menu state (from @react-aria's useTreeState) of the parent menu. To be used to
   * close the current submenu.
   */
  parentMenuState?: TreeState<MenuItemProps>;
  /**
   * Overlay state manager (from useOverlay) for the root (top-most) menu. To be used to
   * close the entire menu system.
   */
  rootOverlayState?: OverlayState;
}

export const DropdownMenuContext = createContext<DropdownMenuContextValue>({});

export interface DropdownMenuListProps
  extends Omit<
      AriaMenuOptions<MenuItemProps>,
      | 'selectionMode'
      | 'selectedKeys'
      | 'defaultSelectedKeys'
      | 'onSelectionChange'
      | 'disallowEmptySelection'
    >,
    TreeProps<MenuItemProps> {
  overlayPositionProps: React.HTMLAttributes<HTMLDivElement>;
  /**
   * The open state of the current overlay that contains this menu
   */
  overlayState: OverlayState;
  /**
   * Whether the menu should close when an item has been clicked/selected
   */
  closeOnSelect?: boolean;
  /**
   * To be displayed below the menu items
   */
  menuFooter?: React.ReactChild;
  /**
   * Title to display on top of the menu
   */
  menuTitle?: React.ReactChild;
  /**
   * Minimum menu width
   */
  minMenuWidth?: number;
  size?: MenuItemProps['size'];
}

function DropdownMenuList({
  closeOnSelect = true,
  onClose,
  minMenuWidth,
  size,
  menuTitle,
  menuFooter,
  overlayState,
  overlayPositionProps,
  ...props
}: DropdownMenuListProps) {
  const {rootOverlayState, parentMenuState} = useContext(DropdownMenuContext);
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
      if (e.key === 'ArrowLeft' && parentMenuState) {
        parentMenuState.selectionManager.clearSelection();
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
      const isSection = node.hasChildNodes && !node.value?.isSubmenu;
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

  const showDividers = stateCollection.some(item => !!item.props.details);

  // Render a single menu item
  const renderItem = (node: Node<MenuItemProps>) => {
    return (
      <DropdownMenuItem
        node={node}
        state={state}
        onClose={onClose}
        closeOnSelect={closeOnSelect}
        showDivider={showDividers}
      />
    );
  };

  // Render a submenu whose trigger button is a menu item
  const renderItemWithSubmenu = (node: Node<MenuItemProps>) => {
    if (!node.value?.children) {
      return null;
    }

    const trigger = (triggerProps: any) => (
      <DropdownMenuItem
        renderAs="div"
        node={node}
        state={state}
        showDivider={showDividers}
        closeOnSelect={false}
        {...omit(triggerProps, [
          'onClick',
          'onDragStart',
          'onKeyDown',
          'onKeyUp',
          'onMouseDown',
          'onPointerDown',
          'onPointerUp',
        ])}
      />
    );

    return (
      <DropdownMenu
        isOpen={state.selectionManager.isSelected(node.key)}
        items={node.value.children}
        trigger={trigger}
        onClose={onClose}
        closeOnSelect={closeOnSelect}
        menuTitle={node.value.submenuTitle}
        isDismissable={false}
        shouldCloseOnBlur={false}
        shouldCloseOnInteractOutside={() => false}
        preventOverflowOptions={{boundary: document.body, altAxis: true}}
        renderWrapAs="li"
        position="right-start"
        offset={-4}
        size={size}
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
          <DropdownMenuSection node={node}>
            {renderCollection([...node.childNodes])}
          </DropdownMenuSection>
        );
      } else {
        itemToRender = node.value?.isSubmenu
          ? renderItemWithSubmenu(node)
          : renderItem(node);
      }

      return (
        <Fragment key={node.key}>
          {itemToRender}
          {showSeparator && <Separator {...separatorProps} />}
        </Fragment>
      );
    });

  const theme = useTheme();
  const contextValue = useMemo(
    () => ({
      rootOverlayState: rootOverlayState ?? overlayState,
      parentMenuState: state,
    }),
    [rootOverlayState, overlayState, state]
  );
  return (
    <FocusScope restoreFocus autoFocus>
      <PositionWrapper zIndex={theme.zIndex.dropdown} {...overlayPositionProps}>
        <DropdownMenuContext.Provider value={contextValue}>
          <StyledOverlay>
            {menuTitle && <MenuTitle>{menuTitle}</MenuTitle>}
            <DropdownMenuListWrap
              ref={menuRef}
              hasTitle={!!menuTitle}
              {...mergeProps(modifiedMenuProps, keyboardProps)}
              style={{
                maxHeight: overlayPositionProps.style?.maxHeight,
                minWidth: minMenuWidth ?? overlayPositionProps.style?.minWidth,
              }}
            >
              {renderCollection(stateCollection)}
            </DropdownMenuListWrap>
            {menuFooter}
          </StyledOverlay>
        </DropdownMenuContext.Provider>
      </PositionWrapper>
    </FocusScope>
  );
}

export default DropdownMenuList;

const StyledOverlay = styled(Overlay)`
  display: flex;
  flex-direction: column;
`;

const DropdownMenuListWrap = styled('ul')<{hasTitle: boolean}>`
  margin: 0;
  padding: ${space(0.5)} 0;
  font-size: ${p => p.theme.fontSizeMedium};
  overflow-x: hidden;
  overflow-y: auto;

  ${p => p.hasTitle && `padding-top: calc(${space(0.5)} + 1px);`}

  &:focus {
    outline: none;
  }
`;

const MenuTitle = styled('div')`
  flex-shrink: 0;
  font-weight: ${p => p.theme.fontWeightBold};
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.headingColor};
  white-space: nowrap;
  padding: ${space(0.75)} ${space(1.5)};
  box-shadow: 0 1px 0 0 ${p => p.theme.translucentInnerBorder};
  z-index: 2;
`;

const Separator = styled('li')`
  list-style-type: none;
  border-top: solid 1px ${p => p.theme.innerBorder};
  margin: ${space(0.5)} ${space(1.5)};
`;
