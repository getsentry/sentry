import {Flex} from '@sentry/scraps/layout';

export function HeaderContainer({children}: {children?: React.ReactNode}) {
  return (
    <Flex justify="space-between" wrap="wrap" gap="lg">
      {children}
    </Flex>
  );
}
