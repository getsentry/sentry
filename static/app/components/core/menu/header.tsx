import {type FlexProps, Stack} from '@sentry/scraps/layout';

export type MenuHeaderProps = Omit<FlexProps, 'children'> & {
  children: React.ReactNode;
};

export function MenuHeader({children, ...props}: MenuHeaderProps) {
  return (
    <Stack gap="xs" padding="sm lg" borderBottom="muted" {...props}>
      {children}
    </Stack>
  );
}
