import {
  BreadcrumbList,
  type BreadcrumbCurrentItem,
  type BreadcrumbListProps,
} from '@sentry/scraps/breadcrumbList';
import {DrawerBody} from '@sentry/scraps/drawer';
import {InputGroup} from '@sentry/scraps/input';
import {Container, Flex, Stack} from '@sentry/scraps/layout';

import {t} from 'sentry/locale';
import {PRIMARY_HEADER_HEIGHT} from 'sentry/views/navigation/constants';

export const SearchInput = InputGroup.Input;

interface DrawerBreadcrumbsProps {
  current: BreadcrumbCurrentItem;
  items?: BreadcrumbListProps['items'];
}

/**
 * Breadcrumbs for drawers and panels. The page already owns the `<h1>` in the
 * TopBar, so the current location renders without a heading. Unlike the TopBar
 * trail, these are rendered in a `<nav>` landmark.
 */
export function DrawerBreadcrumbs({items = [], current}: DrawerBreadcrumbsProps) {
  return (
    <Flex as="nav" aria-label={t('Breadcrumbs')} align="center" flex="1" minWidth="0">
      {items.length === 0 ? (
        <BreadcrumbList.Current item={current} />
      ) : (
        <Flex
          containerType="inline-size"
          width="100%"
          align="center"
          gap="sm"
          minWidth="0"
        >
          <Flex align="center" gap="sm" minWidth="0" flex="0 1 auto">
            <BreadcrumbList items={items} />
          </Flex>
          <Flex align="center" gap="sm" minWidth="0" flexGrow={1}>
            <BreadcrumbList.Current item={current} />
          </Flex>
        </Flex>
      )}
    </Flex>
  );
}

export function EventDrawerContainer({children}: {children: React.ReactNode}) {
  return <Stack height="100%">{children}</Stack>;
}

interface EventNavigatorProps {
  /**
   * The drawer's main control: its search, or its main filter or selector when
   * it has no search. Fills the space on the left; content keeps its natural
   * width unless it stretches itself.
   */
  leadingItems?: React.ReactNode;
  /**
   * Secondary controls and actions, such as sorting, pickers, export, or links
   * to another view. Always right-aligned, even when they are the only control.
   */
  trailingItems?: React.ReactNode;
}

/**
 * The toolbar between the drawer header and the drawer body.
 */
export function EventNavigator({leadingItems, trailingItems}: EventNavigatorProps) {
  return (
    <Flex
      align="center"
      gap="md"
      padding="0 2xl"
      height={`${PRIMARY_HEADER_HEIGHT}px`}
      background="primary"
      borderBottom="primary"
      flexShrink={0}
    >
      {leadingItems ? (
        <Container flex="1" minWidth="0">
          {leadingItems}
        </Container>
      ) : null}
      {trailingItems ? (
        <Flex align="center" gap="md" flexShrink={0} marginLeft="auto">
          {trailingItems}
        </Flex>
      ) : null}
    </Flex>
  );
}

/**
 * The scrollable content of an event drawer. Fills the remaining height of the
 * `EventDrawerContainer`, so the header and navigator stay in place.
 */
export function EventDrawerBody(props: React.ComponentProps<typeof DrawerBody>) {
  return (
    <Stack gap="xl" flex="1" minHeight="0" overflow="auto" overscrollBehavior="contain">
      {stackProps => <DrawerBody {...props} {...stackProps} />}
    </Stack>
  );
}
