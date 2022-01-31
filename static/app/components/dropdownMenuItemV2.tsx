import {forwardRef, Fragment, useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {useHover, useKeyboard} from '@react-aria/interactions';
import {useMenuItem} from '@react-aria/menu';
import {mergeProps} from '@react-aria/utils';
import {TreeState} from '@react-stately/tree';
import {Node} from '@react-types/shared';

import {IconChevron} from 'sentry/icons';
import overflowEllipsis from 'sentry/styles/overflowEllipsis';
import space from 'sentry/styles/space';

export type MenuItemProps = {
  /**
   * Item key. Must be unique across the entire menu, including sub-menus.
   */
  key: string;
  /**
   * Item label. Should prefereably be a string. If not, make sure that
   * there are appropriate aria-labels.
   */
  label: React.ReactNode;
  /**
   * Optional descriptive text. Like 'label', should preferably be a string or
   * have appropriate aria-labels.
   */
  details?: React.ReactNode;
  /*
   * Whether this menu item is a trigger for a nested sub-menu. Only works
   * when `children` is also defined.
   */
  isSubmenu?: boolean;
  /**
   * Passed as the `menuTitle` prop onto the associated sub-menu (applicable
   * if `children` is defined and `isSubmenu` is true)
   */
  submenuTitle?: string;
  /**
   * Whether to show a line divider below this menu item
   */
  showDividers?: boolean;
  /*
   * Items to be added to the left of the label
   */
  leadingItems?: React.ReactNode;
  /*
   * Whether leading items should be centered wrt/ the entire height of the
   * menu item. If false (default), they will be centered wrt/ the first line of the
   * label element.
   */
  leadingItemsSpanFullHeight?: boolean;
  /*
   * Items to be added to the right of the label
   */
  trailingItems?: React.ReactNode;
  /*
   * Whether trailing items should be centered wrt/ the entire height of the
   * menu item. If false (default), they will be centered wrt/ the first line of the
   * label element.
   */
  trailingItemsSpanFullHeight?: boolean;
  /**
   * Function to call when user selects/clicks/taps on the menu item. The
   * item's key is passed as an argument.
   */
  onAction?: (key: MenuItemProps['key']) => void;
  /**
   * Sub-items that are nested inside this item. By default, sub-items are
   * rendered collectively as menu sections inside the current menu. If
   * `isSubmenu` is true, then they will be rendered together in a sub-menu.
   */
  children?: MenuItemProps[];
};

type Props = {
  /**
   * Node representation (from @react-aria) of the item
   */
  node: Node<MenuItemProps>;
  /**
   * Whether this is the last node in the collection
   */
  isLastNode: boolean;
  /**
   * Tree state (from @react-stately) inherited from parent menu
   */
  state: TreeState<MenuItemProps>;
  /**
   * Used to close the menu when needed (e.g. when the item is
   * clicked/selected)
   */
  onClose: () => void;
  /**
   * Whether to close the menu when an item has been clicked/selected
   */
  closeOnSelect: boolean;
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
const MenuItem = forwardRef<React.RefObject<HTMLLIElement>, Props>(
  (
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
    submenuTriggerRef
  ) => {
    const [isHovering, setIsHovering] = useState(false);
    const ref = (submenuTriggerRef ?? useRef(null)) as React.RefObject<HTMLLIElement>;
    const isDisabled = state.disabledKeys.has(node.key);
    const isFocused = state.selectionManager.focusedKey === node.key;
    const item = node.value;

    const actionHandler = () => {
      if (isSubmenuTrigger) {
        state.selectionManager.select(node.key);
      } else {
        item.onAction?.(item.key);
      }
    };

    // Open submenu on hover
    const {hoverProps} = useHover({onHoverChange: setIsHovering});
    useEffect(() => {
      if (isHovering && isFocused) {
        if (isSubmenuTrigger) {
          state.selectionManager.select(node.key);
        } else {
          state.selectionManager.clearSelection();
        }
      }
    }, [isHovering, isFocused]);

    // Open submenu on arrow right key press
    const {keyboardProps} = useKeyboard({
      onKeyDown: e => {
        if (isSubmenuTrigger && e.key === 'ArrowRight') {
          state.selectionManager.select(node.key);
        } else {
          e.continuePropagation();
        }
      },
    });

    // Manage interactive events & create aria- attributes
    const {menuItemProps, labelProps, descriptionProps} = useMenuItem(
      {
        key: node.key,
        onAction: actionHandler,
        onClose,
        closeOnSelect,
        isDisabled,
      },
      state,
      ref
    );

    // Merged menu item props, class names are combined, event handlers chained,
    // etc. See: https://react-spectrum.adobe.com/react-aria/mergeProps.html
    const props = mergeProps(
      submenuTriggerProps,
      menuItemProps,
      hoverProps,
      keyboardProps
    );
    const {
      details,
      leadingItems,
      leadingItemsSpanFullHeight,
      trailingItems,
      trailingItemsSpanFullHeight,
    } = item;
    const label = node.rendered ?? item.label;
    const showDividers = item.showDividers && !isLastNode;

    return (
      <Fragment>
        <Wrap
          ref={ref}
          as={renderAs}
          isDisabled={isDisabled}
          {...props}
          {...(isSubmenuTrigger && {role: 'menuitemradio'})}
        >
          <InnerWrap isFocused={isFocused} role="presentation">
            {leadingItems && (
              <LeadingItems
                isDisabled={isDisabled}
                spanFullHeight={leadingItemsSpanFullHeight}
              >
                {leadingItems}
              </LeadingItems>
            )}
            <ContentWrap
              isFocused={isFocused}
              showDividers={showDividers}
              role="presentation"
            >
              <LabelWrap role="presentation">
                <Label isDisabled={isDisabled} {...labelProps} aria-hidden="true">
                  {label}
                </Label>
                {details && <Details {...descriptionProps}>{details}</Details>}
              </LabelWrap>
              {(trailingItems || isSubmenuTrigger) && (
                <TrailingItems
                  isDisabled={isDisabled}
                  spanFullHeight={trailingItemsSpanFullHeight}
                >
                  {trailingItems}
                  {isSubmenuTrigger && (
                    <IconChevron size="xs" direction="right" aria-hidden="true" />
                  )}
                </TrailingItems>
              )}
            </ContentWrap>
          </InnerWrap>
        </Wrap>
      </Fragment>
    );
  }
);

export default MenuItem;

const Wrap = styled('li')<{isDisabled?: boolean}>`
  position: static;
  list-style-type: none;
  margin: 0;
  padding: 0 ${space(0.5)};
  cursor: pointer;

  ${p => p.isDisabled && `cursor: initial;`}

  &:focus-visible {
    outline: none;
  }
`;

const InnerWrap = styled('div')<{isFocused: boolean}>`
  display: flex;
  position: relative;
  padding: 0 ${space(1)};
  border-radius: ${p => p.theme.borderRadius};
  box-sizing: border-box;

  ${p => p.isFocused && `background: ${p.theme.hover}; z-index: 1;`}
`;

const LeadingItems = styled('div')<{isDisabled?: boolean; spanFullHeight?: boolean}>`
  display: flex;
  align-items: center;
  height: 1.4em;
  gap: ${space(1)};
  padding: ${space(1)} 0;
  margin-top: ${space(1)};
  margin-right: ${space(0.5)};

  ${p => p.isDisabled && `opacity: 0.5;`}
  ${p => p.spanFullHeight && `height: 100%;`}
`;

const ContentWrap = styled('div')<{isFocused: boolean; showDividers?: boolean}>`
  position: relative;
  width: 100%;
  display: flex;
  gap: ${space(2)};
  justify-content: space-between;
  padding: ${space(1)} 0;
  margin-left: ${space(0.5)};

  ${p =>
    p.showDividers &&
    !p.isFocused &&
    `
      &::after {
        content: '';
        position: absolute;
        left: 0;
        bottom: 0;
        width: 100%;
        height: 1px;
        box-shadow:  0 1px 0 0 ${p.theme.innerBorder};
      }
    `}
`;

const LabelWrap = styled('div')`
  padding-right: ${space(1)};
  width: 100%;
`;

const Label = styled('p')<{isDisabled?: boolean}>`
  margin-bottom: 0;
  line-height: 1.4;
  white-space: nowrap;
  ${overflowEllipsis}

  ${p => p.isDisabled && `color: ${p.theme.subText};`}
`;

const Details = styled('p')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
  line-height: 1.2;
  margin-bottom: 0;
  ${overflowEllipsis}
`;

const TrailingItems = styled('div')<{isDisabled?: boolean; spanFullHeight?: boolean}>`
  display: flex;
  align-items: center;
  height: 1.4em;
  gap: ${space(1)};
  margin-right: ${space(0.5)};

  ${p => p.isDisabled && `opacity: 0.5;`}
  ${p => p.spanFullHeight && `height: 100%;`}
`;
