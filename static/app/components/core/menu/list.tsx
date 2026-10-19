import {Container} from '@sentry/scraps/layout';

import {useMenuContext} from './context';

export function getMenuItems(list: HTMLUListElement | null): HTMLElement[] {
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

export function MenuList({children, onKeyDown, ...props}: MenuListProps) {
  const {listRef, searchRef, goBack} = useMenuContext();
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
            if (goBack) {
              event.preventDefault();
              goBack();
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
