import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {useTheme} from '@emotion/react';
import {FocusScope} from '@react-aria/focus';
import {mergeProps} from '@react-aria/utils';
import {IconChevron} from '@sentry/icons/chevron';

import {
  DropdownButton,
  type DropdownButtonProps,
} from '@sentry/scraps/dropdownMenu/dropdownButton';
import {Container, Flex, Stack, type FlexProps} from '@sentry/scraps/layout';
import {
  MenuListItem,
  type MenuListItemProps as BaseMenuListItemProps,
} from '@sentry/scraps/menuListItem';
import {Separator} from '@sentry/scraps/separator';
import {Text} from '@sentry/scraps/text';

import {Overlay, PositionWrapper} from 'sentry/components/overlay';
import type {UseOverlayProps} from 'sentry/utils/useOverlay';
import {useOverlay} from 'sentry/utils/useOverlay';

import {MenuSearchField, type MenuSearchFieldProps} from './searchField';

interface MenuContextValue {
  close: () => void;
  isOpen: boolean;
  listRef: React.RefObject<HTMLUListElement | null>;
  open: () => void;
  overlayProps: ReturnType<typeof useOverlay>['overlayProps'];
  search: string;
  searchRef: React.RefObject<HTMLInputElement | null>;
  setSearch: (search: string) => void;
  triggerProps: ReturnType<typeof useOverlay>['triggerProps'];
  goBack?: () => void;
  isSubmenu?: boolean;
}

const MenuContext = createContext<MenuContextValue | null>(null);

function useMenuContext() {
  const context = useContext(MenuContext);
  if (!context) {
    throw new Error('Menu components must be used inside Menu');
  }
  return context;
}

export interface MenuProps extends Pick<
  UseOverlayProps,
  'isOpen' | 'defaultOpen' | 'onOpenChange' | 'position' | 'offset'
> {
  children: React.ReactNode;
}

function MenuRoot({
  children,
  isOpen,
  defaultOpen,
  onOpenChange,
  position = 'bottom-start',
  offset = 8,
}: MenuProps) {
  const overlay = useOverlay({
    isOpen,
    defaultOpen,
    onOpenChange,
    position,
    offset,
    type: 'menu',
    shouldCloseOnBlur: true,
    shouldApplyMinWidth: false,
  });
  const listRef = useRef<HTMLUListElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');

  return (
    <MenuContext
      value={{
        isOpen: overlay.isOpen,
        overlayProps: overlay.overlayProps,
        triggerProps: overlay.triggerProps,
        close: overlay.state.close,
        listRef,
        open: overlay.state.open,
        searchRef,
        search,
        setSearch,
      }}
    >
      {children}
    </MenuContext>
  );
}

export type MenuTriggerProps = Omit<DropdownButtonProps, 'isOpen'> & {
  children: React.ReactNode;
};

function MenuTrigger(props: MenuTriggerProps) {
  const {isOpen, open, triggerProps} = useMenuContext();
  const mergedProps = mergeProps(triggerProps, props);
  return (
    <DropdownButton
      {...mergedProps}
      isOpen={isOpen}
      onKeyDown={event => {
        mergedProps.onKeyDown?.(event);
        if (!event.defaultPrevented && event.key === 'ArrowDown') {
          event.preventDefault();
          open();
        }
      }}
    >
      {props.children}
    </DropdownButton>
  );
}

export interface MenuContentProps {
  children: React.ReactNode;
}

function MenuContent({children}: MenuContentProps) {
  const {isOpen, overlayProps, listRef, searchRef} = useMenuContext();
  const theme = useTheme();

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      (searchRef.current ?? getMenuItems(listRef.current)[0])?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [isOpen, listRef, searchRef]);

  if (!isOpen) {
    return null;
  }

  return (
    <FocusScope restoreFocus>
      <PositionWrapper zIndex={theme.zIndex.dropdown} {...overlayProps}>
        <Overlay>
          <Stack>{children}</Stack>
        </Overlay>
      </PositionWrapper>
    </FocusScope>
  );
}

export interface MenuHeaderProps extends Omit<FlexProps, 'title'> {
  title?: React.ReactNode;
}

function MenuHeader({title, children, ...props}: MenuHeaderProps) {
  return (
    <Stack borderBottom="muted" padding="sm lg" gap="xs" {...props}>
      {title && (
        <Text size="sm" bold>
          {title}
        </Text>
      )}
      {children}
    </Stack>
  );
}

export type MenuSearchProps = Omit<MenuSearchFieldProps, 'value' | 'onChange'>;

function MenuSearch(props: MenuSearchProps) {
  const {listRef, search, searchRef, setSearch} = useMenuContext();
  return (
    <MenuSearchField
      {...props}
      ref={searchRef}
      value={search}
      onChange={event => setSearch(event.target.value)}
      onKeyDown={event => {
        props.onKeyDown?.(event);
        if (event.defaultPrevented) {
          return;
        }
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          getMenuItems(listRef.current)[0]?.focus();
        }
      }}
    />
  );
}

function getMenuItems(list: HTMLUListElement | null): HTMLElement[] {
  if (!list) {
    return [];
  }
  return [...list.querySelectorAll<HTMLElement>('[role="menuitem"]')].filter(
    item =>
      item.closest('[role="menu"]') === list &&
      !item.closest('[hidden]') &&
      item.getAttribute('aria-disabled') !== 'true'
  );
}

export interface MenuListProps extends React.HTMLAttributes<HTMLUListElement> {
  children: React.ReactNode;
}

function MenuList({children, onKeyDown, ...props}: MenuListProps) {
  const {listRef, searchRef, goBack, isSubmenu} = useMenuContext();
  return (
    <Container
      as="ul"
      margin="0"
      padding="xs 0"
      overflowY="auto"
      overflowX="hidden"
      maxHeight="min(80vh, 400px)"
      {...props}
      ref={listRef}
      role="menu"
      tabIndex={-1}
      onKeyDown={event => {
        onKeyDown?.(event);
        if (event.defaultPrevented) {
          return;
        }
        const items = getMenuItems(listRef.current);
        const index = items.indexOf(document.activeElement as HTMLElement);
        let next: HTMLElement | undefined;
        switch (event.key) {
          case 'ArrowDown':
            next = items[(index + 1) % items.length];
            break;
          case 'ArrowUp':
            next =
              index === 0 && searchRef.current
                ? searchRef.current
                : items[(index - 1 + items.length) % items.length];
            break;
          case 'Home':
            next = items[0];
            break;
          case 'End':
            next = items.at(-1);
            break;
          case 'ArrowLeft':
            if (isSubmenu) {
              event.preventDefault();
              goBack?.();
            }
            return;
          default:
            return;
        }
        if (next) {
          event.preventDefault();
          next.focus();
        }
      }}
    >
      {children}
    </Container>
  );
}

interface SectionContextValue {
  labelId: string;
  setItemVisibility: (id: string, visible: boolean | null) => void;
}

const SectionContext = createContext<SectionContextValue | null>(null);

export interface MenuSectionProps {
  children: React.ReactNode;
  'aria-label'?: string;
}

function MenuSection({children, 'aria-label': ariaLabel}: MenuSectionProps) {
  const labelId = useId();
  const [visibleItems, setVisibleItems] = useState<Record<string, boolean>>({});
  const setItemVisibility = useCallback((id: string, visible: boolean | null) => {
    setVisibleItems(previous => {
      if (visible === null) {
        const next = {...previous};
        delete next[id];
        return next;
      }
      return previous[id] === visible ? previous : {...previous, [id]: visible};
    });
  }, []);
  const sectionContext = useMemo(
    () => ({labelId, setItemVisibility}),
    [labelId, setItemVisibility]
  );
  const isEmpty =
    Object.values(visibleItems).length > 0 && !Object.values(visibleItems).some(Boolean);

  return (
    <SectionContext value={sectionContext}>
      <Container
        as="li"
        display={isEmpty ? 'none' : 'block'}
        role="presentation"
        hidden={isEmpty}
      >
        <Container
          as="ul"
          margin="0"
          padding="0"
          role="group"
          aria-label={ariaLabel}
          aria-labelledby={ariaLabel ? undefined : labelId}
        >
          {children}
        </Container>
      </Container>
    </SectionContext>
  );
}

export interface MenuSectionLabelProps {
  children: React.ReactNode;
}

function MenuSectionLabel({children}: MenuSectionLabelProps) {
  const section = useContext(SectionContext);
  return (
    <Container
      as="li"
      display="block"
      role="presentation"
      id={section?.labelId}
      padding="xs lg"
    >
      <Text size="xs" variant="muted" bold uppercase>
        {children}
      </Text>
    </Container>
  );
}

export interface MenuListItemProps extends Omit<BaseMenuListItemProps, 'label'> {
  label: React.ReactNode;
  closeOnSelect?: boolean;
  onAction?: () => void;
  textValue?: string;
}

function MenuItem({
  label,
  textValue,
  onAction,
  closeOnSelect = true,
  disabled,
  ...props
}: MenuListItemProps) {
  const {search, close} = useMenuContext();
  const section = useContext(SectionContext);
  const id = useId();
  const [isFocused, setFocused] = useState(false);
  const text = textValue ?? (typeof label === 'string' ? label : '');
  const hidden = Boolean(
    search && !text.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
  );

  useLayoutEffect(() => {
    section?.setItemVisibility(id, !hidden);
    return () => section?.setItemVisibility(id, null);
  }, [section, id, hidden]);

  return (
    <Container
      as="li"
      display={hidden ? 'none' : 'block'}
      role="presentation"
      hidden={hidden}
    >
      <MenuListItem
        as="div"
        {...props}
        label={label}
        disabled={disabled}
        isFocused={isFocused}
        innerWrapProps={{
          role: 'menuitem',
          tabIndex: disabled ? undefined : -1,
          'aria-disabled': disabled || undefined,
          onFocus: () => setFocused(true),
          onBlur: () => setFocused(false),
          onClick: () => {
            if (disabled) {
              return;
            }
            onAction?.();
            if (closeOnSelect) {
              close();
            }
          },
          onKeyDown: event => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              event.currentTarget.click();
            }
          },
        }}
      />
    </Container>
  );
}

function MenuSectionSeparator() {
  const {search} = useMenuContext();
  return (
    <Container
      as="li"
      display={search ? 'none' : 'block'}
      role="presentation"
      padding="xs lg"
    >
      <Separator orientation="horizontal" border="muted" />
    </Container>
  );
}

export type MenuFooterProps = FlexProps;

function MenuFooter(props: MenuFooterProps) {
  return <Flex borderTop="muted" padding="md lg" align="center" {...props} />;
}

export interface MenuSubmenuProps extends Pick<MenuListItemProps, 'label' | 'disabled'> {
  children: React.ReactNode;
  textValue?: string;
}

function MenuSubmenu({label, children, disabled, textValue}: MenuSubmenuProps) {
  const parent = useMenuContext();
  const section = useContext(SectionContext);
  const id = useId();
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
  const text = textValue ?? (typeof label === 'string' ? label : '');
  const hidden = Boolean(
    parent.search &&
    !text.toLocaleLowerCase().includes(parent.search.trim().toLocaleLowerCase())
  );

  useLayoutEffect(() => {
    section?.setItemVisibility(id, !hidden);
    return () => section?.setItemVisibility(id, null);
  }, [section, id, hidden]);

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
        isFocused={isFocused}
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
          onMouseEnter: () => !disabled && setOpen(true),
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

export const Menu = Object.assign(MenuRoot, {
  Trigger: MenuTrigger,
  Content: MenuContent,
  Header: MenuHeader,
  Search: MenuSearch,
  List: MenuList,
  Section: MenuSection,
  SectionLabel: MenuSectionLabel,
  ListItem: MenuItem,
  SectionSeparator: MenuSectionSeparator,
  Footer: MenuFooter,
  Submenu: MenuSubmenu,
});
