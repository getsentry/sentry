import {type FlexProps, Stack} from '@sentry/scraps/layout';

export interface MenuHeaderProps extends FlexProps {
  children: React.ReactNode;
}

export function MenuHeader({children, ...props}: MenuHeaderProps) {
  return (
    <Stack gap="xs" padding="sm lg" borderBottom="muted" {...props}>
      {children}
    </Stack>
  );
}
