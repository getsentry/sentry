import {Flex, type FlexProps} from '@sentry/scraps/layout';

export interface MenuFooterProps extends FlexProps {
  children: React.ReactNode;
}

export function MenuFooter({children, ...props}: MenuFooterProps) {
  return (
    <Flex align="center" padding="md lg" borderTop="muted" {...props}>
      {children}
    </Flex>
  );
}
