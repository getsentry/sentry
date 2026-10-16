import {Flex, type FlexProps} from '@sentry/scraps/layout';

export type MenuFooterProps = Omit<FlexProps, 'children'> & {
  children: React.ReactNode;
};

/** Actions below the scrolling menu or listbox. */
export function MenuFooter({children, ...props}: MenuFooterProps) {
  return (
    <Flex align="center" padding="md lg" borderTop="muted" {...props}>
      {children}
    </Flex>
  );
}
