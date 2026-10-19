import {useRef, useState} from 'react';
import {useMenuItem} from '@react-aria/menu';
import {IconChevron} from '@sentry/icons/chevron';

import {Container} from '@sentry/scraps/layout';
import {MenuListItem} from '@sentry/scraps/menuListItem';

import {useOverlay} from 'sentry/utils/useOverlay';

import {MenuContext, useMenuContext} from './context';
import type {MenuListItemProps} from './item';
import {isMenuItemHidden} from './item';
import {useMenuListState} from './list';
import {SectionContext, useSectionItemVisibility} from './section';

export interface MenuSubmenuProps extends Pick<MenuListItemProps, 'label' | 'disabled'> {
  children: React.ReactNode;
  itemKey?: string;
  textValue?: string;
}

/** Opens a nested menu with its own search and keyboard navigation state. */
export function MenuSubmenu({
  label,
  children,
  disabled,
  itemKey,
  textValue,
}: MenuSubmenuProps) {
  const parent = useMenuContext();
  const state = useMenuListState();
  const [isOpen, setOpen] = useState(false);
  const overlay = useOverlay({
    isOpen,
    onOpenChange: open => {
      setOpen(open);
      if (!open) {
        requestAnimationFrame(() => overlay.triggerRef.current?.focus());
      }
    },
    position: 'right-start',
    offset: -4,
    type: 'menu',
    shouldApplyMinWidth: false,
  });
  const listRef = useRef<HTMLUListElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [isFocused, setFocused] = useState(false);
  const [isHovered, setHovered] = useState(false);
  const hidden = isMenuItemHidden(parent.search, label, textValue);
  useSectionItemVisibility(!hidden);
  const {menuItemProps} = useMenuItem(
    {
      key: itemKey ?? '',
      isDisabled: disabled,
      closeOnSelect: false,
      onAction: () => setOpen(value => !value),
    },
    state,
    overlay.triggerRef
  );

  return (
    <Container
      as="li"
      display={hidden ? 'none' : 'block'}
      role="presentation"
      hidden={hidden}
    >
      <MenuListItem
        as="div"
        label={label}
        disabled={disabled}
        isFocused={isFocused || isHovered}
        trailingItems={<IconChevron size="xs" direction="right" aria-hidden="true" />}
        innerWrapProps={{
          ...menuItemProps,
          role: 'menuitem',
          'aria-haspopup': 'menu',
          'aria-expanded': isOpen,
          ref: overlay.triggerProps.ref,
          onFocus: event => {
            menuItemProps.onFocus?.(event);
            setFocused(true);
          },
          onBlur: event => {
            menuItemProps.onBlur?.(event);
            setFocused(false);
          },
          onMouseEnter: () => {
            if (!disabled) {
              setHovered(true);
              setOpen(true);
            }
          },
          onMouseLeave: () => setHovered(false),
          onKeyDown: event => {
            if (
              event.key === 'ArrowRight' ||
              event.key === 'Enter' ||
              event.key === ' '
            ) {
              event.preventDefault();
              event.stopPropagation();
              if (!disabled) {
                setOpen(true);
              }
              return;
            }
            menuItemProps.onKeyDown?.(event);
          },
        }}
      />
      <MenuContext
        value={{
          isOpen: overlay.isOpen,
          overlayProps: overlay.overlayProps,
          triggerProps: overlay.triggerProps,
          close: parent.close,
          open: overlay.state.open,
          goBack: () => {
            overlay.state.close();
            overlay.triggerRef.current?.focus();
          },
          listRef,
          searchRef,
          search,
          setSearch,
        }}
      >
        {/* Nested items must not affect the parent section's search visibility. */}
        <SectionContext value={null}>{children}</SectionContext>
      </MenuContext>
    </Container>
  );
}
