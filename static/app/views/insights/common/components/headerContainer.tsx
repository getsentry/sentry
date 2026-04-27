import {Flex, type FlexProps} from '@sentry/scraps/layout';

export function HeaderContainer(props: FlexProps) {
  return <Flex justify="between" wrap="wrap" gap="xl" {...props} />;
}
