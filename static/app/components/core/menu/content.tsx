import {createContext, useContext, useEffect} from 'react';
import {useTheme} from '@emotion/react';
import {FocusScope} from '@react-aria/focus';

import {Container, Stack, type FlexProps} from '@sentry/scraps/layout';
import {SearchInput, type SearchInputProps} from '@sentry/scraps/menu/searchInput';

import {Overlay, PositionWrapper} from 'sentry/components/overlay';

import {useMenuContext, type MenuContextValue} from './context';
import {MenuFooterLayout, MenuHeaderLayout, MenuHeading} from './layout';
import {getMenuItems} from './list';

const MenuHeaderContext = createContext<MenuContextValue | null>(null);

export interface MenuContentProps {
  children: React.ReactNode;
}

export function MenuContent({children}: MenuContentProps) {
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
          <Stack minWidth="240px">{children}</Stack>
        </Overlay>
      </PositionWrapper>
    </FocusScope>
  );
}

export interface MenuHeaderProps extends Omit<FlexProps, 'title'> {
  title?: React.ReactNode;
}

export function MenuHeader({title, children, ...props}: MenuHeaderProps) {
  const menu = useMenuContext();
  return (
    <MenuHeaderContext value={menu}>
      <MenuHeaderLayout padding="xs" {...props}>
        {title && (
          <Container padding="md lg">
            <MenuHeading>{title}</MenuHeading>
          </Container>
        )}
        {children}
      </MenuHeaderLayout>
    </MenuHeaderContext>
  );
}

export type MenuSearchProps = Omit<SearchInputProps, 'value' | 'onChange'>;

export function MenuSearch(props: MenuSearchProps) {
  const headerMenu = useContext(MenuHeaderContext);
  const menu = useMenuContext();
  if (headerMenu !== menu) {
    throw new Error('Menu.Search must be used inside Menu.Header');
  }
  const {listRef, search, searchRef, setSearch} = menu;
  return (
    <Container padding="0 xs xs xs">
      <SearchInput
        {...props}
        ref={searchRef}
        size="md"
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
    </Container>
  );
}

export type MenuFooterProps = FlexProps;

export function MenuFooter(props: MenuFooterProps) {
  return <MenuFooterLayout padding="md lg" {...props} />;
}
