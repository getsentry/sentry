import {useSeparator} from '@react-aria/separator';

import type {SelectKey} from '@sentry/scraps/compactSelect';
import {Container} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import type {UseOverlayProps} from 'sentry/utils/useOverlay';

import type {MenuItemProps} from './item';

/** An action in a composed DropdownMenu. MenuListItem supplies its visual appearance. */
export function MenuItem(
  _props: Omit<MenuItemProps, 'key' | 'children'> & {itemKey: string}
) {
  return null;
}

export interface MenuSectionProps {
  children: React.ReactNode;
  'aria-label'?: string;
  sectionKey?: SelectKey;
}

/** Groups menu actions or listbox options into one React Aria section. */
export function MenuSection(_props: MenuSectionProps) {
  return null;
}

export function MenuSectionLabel({
  children,
  id,
}: {
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <Text as="span" id={id} size="xs" variant="secondary" bold uppercase>
      {children}
    </Text>
  );
}

/** An explicit divider before the following section. */
export function MenuSectionSeparator() {
  const {separatorProps} = useSeparator({elementType: 'li'});
  return (
    <Container
      as="li"
      {...separatorProps}
      borderTop="muted"
      margin="xs lg"
      style={{listStyle: 'none'}}
    />
  );
}

export interface SubmenuProps extends Omit<
  MenuItemProps,
  'key' | 'children' | 'submenu'
> {
  children: React.ReactNode;
  itemKey: string;
  position?: UseOverlayProps['position'];
  title?: string;
}

/** A nested action menu. Submenus are not valid listbox options. */
export function Submenu(_props: SubmenuProps) {
  return null;
}
