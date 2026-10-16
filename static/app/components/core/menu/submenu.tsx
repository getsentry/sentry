import {useRef, useState} from 'react';
import {IconChevron} from '@sentry/icons/chevron';

import {Container} from '@sentry/scraps/layout';
import {MenuListItem} from '@sentry/scraps/menuListItem';

import {useOverlay} from 'sentry/utils/useOverlay';

import {MenuContext, useMenuContext} from './context';
import type {MenuListItemProps} from './item';
import {isMenuItemHidden} from './item';
import {SectionContext, useSectionItemVisibility} from './section';

export interface MenuSubmenuProps extends Pick<MenuListItemProps, 'label' | 'disabled'> {
  children: React.ReactNode;
  textValue?: string;
}

export function MenuSubmenu({label, children, disabled, textValue}: MenuSubmenuProps) {
  const parent = useMenuContext();
  const [isOpen, setOpen] = useState(false);
  const overlay = useOverlay({
    isOpen,
    onOpenChange: setOpen,
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
          role: 'menuitem',
          tabIndex: disabled ? undefined : -1,
          'aria-haspopup': 'menu',
          'aria-expanded': isOpen,
          'aria-disabled': disabled || undefined,
          ref: overlay.triggerProps.ref,
          onFocus: () => setFocused(true),
          onBlur: () => setFocused(false),
          onMouseEnter: () => {
            if (!disabled) {
              setHovered(true);
              setOpen(true);
            }
          },
          onMouseLeave: () => setHovered(false),
          onClick: () => !disabled && setOpen(value => !value),
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
            }
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
          isSubmenu: true,
        }}
      >
        <SectionContext value={null}>{children}</SectionContext>
      </MenuContext>
    </Container>
  );
}
