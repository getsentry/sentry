import {Flex, type FlexProps, Stack} from '@sentry/scraps/layout';

type MenuRegionProps = Omit<FlexProps, 'children'> & {children: React.ReactNode};

/** Content above the scrolling menu or listbox. May contain interactive controls. */
export function MenuHeader({children, ...props}: MenuRegionProps) {
  return (
    <Stack gap="xs" padding="sm lg" borderBottom="muted" {...props}>
      {children}
    </Stack>
  );
}

/** Actions below the scrolling menu or listbox. */
export function MenuFooter({children, ...props}: MenuRegionProps) {
  return (
    <Flex align="center" padding="md lg" borderTop="muted" {...props}>
      {children}
    </Flex>
  );
}
