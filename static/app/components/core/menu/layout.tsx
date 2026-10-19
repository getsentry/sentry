import {Container, Flex, Stack, type FlexProps} from '@sentry/scraps/layout';
import type {ContainerProps} from '@sentry/scraps/layout/container';
import {Separator} from '@sentry/scraps/separator';
import {Text} from '@sentry/scraps/text';

/** Container for a menu header, with a divider below it. */
export function MenuHeaderLayout(props: FlexProps) {
  return <Stack borderBottom="muted" gap="0" {...props} />;
}

/** Text style for the menu's main heading. */
export function MenuHeading({children}: {children: React.ReactNode}) {
  return (
    <Text size="sm" density="fixed" bold tabular>
      {children}
    </Text>
  );
}

/** Text style for a heading within a menu section. */
export function MenuSectionHeading({
  children,
  ...props
}: Omit<React.HTMLAttributes<HTMLSpanElement>, 'color' | 'style'> & {
  children: React.ReactNode;
}) {
  return (
    <Text as="span" size="sm" density="fixed" bold tabular {...props}>
      {children}
    </Text>
  );
}

/** Divider between menu sections. */
export function MenuSectionDivider() {
  return <Separator orientation="horizontal" border="muted" />;
}

/** List item wrapper for a menu section. */
export function MenuSectionLayout(props: ContainerProps<'li'>) {
  return <Container as="li" display="block" {...props} />;
}

/** List wrapper for the items within a menu section. */
export function MenuSectionGroup(props: ContainerProps<'ul'>) {
  return <Container as="ul" margin="0" padding="0" {...props} />;
}

/** Container for menu footer actions, with a divider above it. */
export function MenuFooterLayout(props: FlexProps) {
  return <Flex borderTop="muted" align="center" {...props} />;
}
