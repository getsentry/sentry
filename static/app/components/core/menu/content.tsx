import {createContext, useContext, useEffect} from 'react';
import {css, useTheme} from '@emotion/react';
import {FocusScope} from '@react-aria/focus';
import {IconSearch} from '@sentry/icons/search';

import {InputGroup} from '@sentry/scraps/input';
import {Container, Flex, Stack, type FlexProps} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {Overlay, PositionWrapper} from 'sentry/components/overlay';

import {useMenuContext, type MenuContextValue} from './context';
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
      <Stack borderBottom="muted" padding="xs" gap="0" {...props}>
        {title && (
          <Container padding="md lg">
            <Text
              size="sm"
              density="fixed"
              bold
              tabular
              css={theme => css`
                color: ${theme.tokens.interactive.transparent.neutral.content.headings};
              `}
            >
              {title}
            </Text>
          </Container>
        )}
        {children}
      </Stack>
    </MenuHeaderContext>
  );
}

type SearchInputProps = React.ComponentPropsWithRef<typeof InputGroup.Input>;

export function SearchInput({
  containerPadding = 'xs',
  ...props
}: SearchInputProps & {
  containerPadding?: React.ComponentProps<typeof Container>['padding'];
}) {
  return (
    <Container padding={containerPadding}>
      <InputGroup>
        <InputGroup.LeadingItems disablePointerEvents>
          <Flex paddingLeft="2xs" align="center" justify="center">
            <IconSearch size="xs" variant="muted" />
          </Flex>
        </InputGroup.LeadingItems>
        <InputGroup.Input size="xs" {...props} />
      </InputGroup>
    </Container>
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
    <SearchInput
      {...props}
      containerPadding="0 xs xs xs"
      ref={searchRef}
      size="md"
      css={css`
        font-variant-numeric: lining-nums tabular-nums;
      `}
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

export type MenuFooterProps = FlexProps;

export function MenuFooter(props: MenuFooterProps) {
  return <Flex borderTop="muted" padding="md lg" align="center" {...props} />;
}
