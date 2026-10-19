import {Container, Flex, Stack, type FlexProps} from '@sentry/scraps/layout';
import type {ContainerProps} from '@sentry/scraps/layout/container';
import {Separator} from '@sentry/scraps/separator';
import {Text} from '@sentry/scraps/text';

export function MenuHeaderLayout(props: FlexProps) {
  return <Stack borderBottom="muted" gap="0" {...props} />;
}

export function MenuHeading({children}: {children: React.ReactNode}) {
  return (
    <Text size="sm" density="fixed" bold tabular>
      {children}
    </Text>
  );
}

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

export function MenuSectionDivider() {
  return <Separator orientation="horizontal" border="muted" />;
}

export function MenuSectionLayout(props: ContainerProps<'li'>) {
  return <Container as="li" display="block" {...props} />;
}

export function MenuFooterLayout(props: FlexProps) {
  return <Flex borderTop="muted" align="center" {...props} />;
}
