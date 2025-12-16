import {Flex} from '@sentry/scraps/layout';

export function WidgetToolbar({children}: {children?: React.ReactNode}) {
  return <Flex gap="xs">{children}</Flex>;
}
