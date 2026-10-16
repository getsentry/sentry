import {type FlexProps, Stack} from '@sentry/scraps/layout';

export type MenuHeaderProps = Omit<FlexProps, 'children'> & {
  children: React.ReactNode;
};

/** Content above the scrolling menu or listbox. May contain interactive controls. */
export function MenuHeader({children, ...props}: MenuHeaderProps) {
  return (
    <Stack gap="xs" padding="sm lg" borderBottom="muted" {...props}>
      {children}
    </Stack>
  );
}
